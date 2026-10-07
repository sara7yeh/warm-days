import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  type Entry,
  type Event,
  type Kind,
  type ReminderHour,
  type OfKind,
  meta,
  recordSchema,
} from "./model";
import { type Occurrence } from "./domain";
import { addDays } from "./dates";
import { useLife, service } from "./context";
import { Modal, Field } from "./ui";
type EditableKind = Exclude<
  Kind,
  "instance" | "checkin" | "receipt" | "session" | "journal"
>;
const titles: Record<EditableKind, string> = {
  event: "日程",
  task: "待办",
  health: "身体记录",
  habit: "习惯",
  memo: "备忘录",
  anniversary: "纪念日",
};
export function Editor({
  kind,
  entry,
  date,
  onClose,
  occurrence,
}: {
  kind: EditableKind;
  entry?: Entry;
  date?: string;
  onClose: () => void;
  occurrence?: Occurrence;
}) {
  const { state, today, run } = useLife();
  const base = entry as any;
  const [reminders, setReminders] = useState<ReminderHour[]>(
    occurrence?.reminders ?? base?.reminders ?? state.settings.reminderDefaults,
  );
  const [repeat, setRepeat] = useState(
    occurrence?.repeat ?? base?.repeat ?? false,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    base?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
  );
  const [mode, setMode] = useState(base?.mode ?? "check");
  const [scope, setScope] = useState<"one" | "future">("one");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [measures, setMeasures] = useState<{ name: string; value: string }[]>(
    base?.measures
      ? Object.entries(base.measures).map(([name, value]) => ({
          name,
          value: String(value),
        }))
      : [
          { name: "腰围", value: "" },
          { name: "大腿围", value: "" },
        ],
  );
  const model = occurrence ?? base;
  const day = model?.date ?? date ?? today;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const str = (key: string) => String(f.get(key) ?? "");
    const num = (key: string) =>
      str(key) === "" ? undefined : Number(str(key));
    let data: any = { ...meta(), ...entry, kind };
    try {
      if (kind === "event")
        data = {
          ...data,
          title: str("title"),
          date: str("date"),
          time: str("time") || undefined,
          endTime: str("endTime") || undefined,
          category: str("category"),
          notes: str("notes"),
          reminders,
          repeat: occurrence && scope === "one" ? occurrence.repeat : repeat,
          until:
            occurrence && scope === "one"
              ? base?.until
              : repeat
                ? str("until")
                : undefined,
        };
      if (kind === "task")
        data = {
          ...data,
          title: str("title"),
          date: str("date") || undefined,
          category: str("category"),
          notes: str("notes"),
          done: base?.done ?? false,
        };
      if (kind === "health") {
        const values: Record<string, number> = {};
        for (const m of measures) {
          if (m.value === "") continue;
          if (!m.name.trim()) throw new Error("请填写围度名称");
          if (Object.hasOwn(values, m.name.trim()))
            throw new Error("围度名称不能重复");
          values[m.name.trim()] = Number(m.value);
        }
        data = {
          ...data,
          date: str("date"),
          exercised: f.has("exercised"),
          exercise: str("exercise"),
          food: str("food"),
          weight: num("weight"),
          measures: values,
        };
      }
      if (kind === "habit")
        data = {
          ...data,
          title: str("title"),
          mode,
          target: mode === "check" ? 1 : num("target"),
          unit: mode === "check" ? "次" : str("unit"),
          weekdays,
          startDate: str("startDate"),
        };
      if (kind === "memo")
        data = { ...data, title: str("title"), body: str("body") };
      if (kind === "anniversary")
        data = {
          ...data,
          title: str("title"),
          date: str("date"),
          mode: str("mode"),
        };
      // A moved single occurrence need not share its series end date.
      const validated = recordSchema.parse(
        kind === "event" && occurrence && scope === "one"
          ? { ...data, repeat: false, until: undefined }
          : data,
      );
      const success = await run(
        () =>
          occurrence
            ? service.editOccurrence(
                occurrence.eventId,
                occurrence.occurrenceDate,
                validated as Event,
                scope,
              )
            : service.save(validated, entry?.updatedAt),
        "已保存",
      );
      if (success) onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? ((e as any).issues
              ?.map((i: any) => `${i.path.join(".")}: ${i.message}`)
              .join("；") ?? e.message)
          : "请检查输入",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${entry || occurrence ? "编辑" : "添加"}${titles[kind]}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {occurrence && (
          <Field label="修改范围">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "one" | "future")}
            >
              <option value="one">仅本次（保留其他课程）</option>
              <option value="future">
                本次及以后（重新安排，清除未来例外）
              </option>
            </select>
          </Field>
        )}
        {kind !== "health" && (
          <Field label={kind === "habit" ? "习惯名称" : "名称"}>
            <input
              name="title"
              defaultValue={model?.title ?? ""}
              required
              maxLength={kind === "habit" || kind === "anniversary" ? 100 : 200}
              placeholder={
                {
                  event: "例如：高等数学 / 和朋友吃晚饭",
                  task: "例如：完成本周的作业",
                  habit: "例如：喝水 / 阅读",
                  memo: "给这个念头起个名字",
                  anniversary: "例如：和他在一起",
                }[kind]
              }
              autoFocus
            />
          </Field>
        )}
        {["event", "task", "health", "anniversary"].includes(kind) && (
          <Field label={kind === "task" ? "日期（可不填）" : "日期"}>
            <input
              type="date"
              name="date"
              defaultValue={kind === "task" ? (base?.date ?? "") : day}
              required={kind !== "task"}
            />
          </Field>
        )}
        {kind === "event" && (
          <>
            <div className="form-row">
              <Field label="开始时间（不填则为全天）">
                <input
                  type="time"
                  name="time"
                  defaultValue={model?.time ?? ""}
                />
              </Field>
              <Field label="结束时间（可选）">
                <input
                  type="time"
                  name="endTime"
                  defaultValue={model?.endTime ?? ""}
                />
              </Field>
            </div>
            {(!occurrence || scope === "future") && (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(e) => setRepeat(e.target.checked)}
                  />
                  每周这一天重复
                </label>
                {repeat && (
                  <Field label="重复至">
                    <input
                      type="date"
                      name="until"
                      defaultValue={base?.until ?? addDays(day, 112)}
                      required
                    />
                  </Field>
                )}
              </>
            )}
          </>
        )}
        {["event", "task"].includes(kind) && (
          <>
            <Field label="分类">
              <select
                name="category"
                defaultValue={
                  model?.category ?? (kind === "event" ? "课程" : "日常")
                }
              >
                {Array.from(
                  new Set(
                    [...state.settings.categories, model?.category].filter(
                      Boolean,
                    ),
                  ),
                ).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="备注">
              <textarea
                name="notes"
                rows={3}
                maxLength={20000}
                defaultValue={model?.notes ?? ""}
                placeholder="地点、需要带的东西，或一点小提醒"
              />
            </Field>
          </>
        )}
        {kind === "event" && (
          <>
            <Field label="提前提醒（可多选）">
              <div className="chips">
                {([1, 3, 5, 7] as ReminderHour[]).map((h) => (
                  <button
                    type="button"
                    aria-label={`提前${h}小时`}
                    aria-pressed={reminders.includes(h)}
                    key={h}
                    className={`chip ${reminders.includes(h) ? "selected" : ""}`}
                    onClick={() =>
                      setReminders(
                        reminders.includes(h)
                          ? reminders.filter((x) => x !== h)
                          : [...reminders, h],
                      )
                    }
                  >
                    {h} 小时
                  </button>
                ))}
              </div>
            </Field>
            <p className="hint">
              只填日期时以当天23:59为基准。提醒仅在本站运行时显示。
            </p>
          </>
        )}
        {kind === "health" && (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="exercised"
                defaultChecked={base?.exercised ?? false}
              />
              今天运动了
            </label>
            <Field label="做了什么运动？">
              <textarea
                name="exercise"
                rows={2}
                maxLength={2000}
                defaultValue={base?.exercise ?? ""}
                placeholder="例如：散步30分钟、练腿…"
              />
            </Field>
            <Field label="今天吃了些什么？">
              <textarea
                name="food"
                rows={3}
                maxLength={5000}
                defaultValue={base?.food ?? ""}
                placeholder="好好吃饭，也是一种照顾自己"
              />
            </Field>
            <Field label="体重（kg，可不填）">
              <input
                type="number"
                name="weight"
                min="0.1"
                max="1000"
                step="0.1"
                defaultValue={base?.weight ?? ""}
              />
            </Field>
            <p className="hint">围度（cm，可不填）</p>
            {measures.map((m, index) => (
              <div className="measure-row" key={index}>
                <input
                  aria-label={`围度名称${index + 1}`}
                  value={m.name}
                  maxLength={30}
                  list="measure-names"
                  onChange={(e) =>
                    setMeasures(
                      measures.map((x, i) =>
                        i === index ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  aria-label={`${m.name || "围度"}厘米`}
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  value={m.value}
                  onChange={(e) =>
                    setMeasures(
                      measures.map((x, i) =>
                        i === index ? { ...x, value: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label="移除此围度"
                  onClick={() =>
                    setMeasures(measures.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <datalist id="measure-names">
              {["腰围", "大腿围", "臀围", "胸围"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </datalist>
            <button
              type="button"
              className="soft-button"
              onClick={() =>
                setMeasures([...measures, { name: "", value: "" }])
              }
            >
              <Plus size={16} />
              添加围度
            </button>
          </>
        )}
        {kind === "habit" && (
          <>
            <Field label="开始日期（可设置过去日期补打卡）">
              <input
                type="date"
                name="startDate"
                required
                defaultValue={base?.startDate ?? today}
              />
            </Field>
            <Field label="打卡方式">
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="check">勾选完成</option>
                <option value="quantity">数量目标</option>
              </select>
            </Field>
            {mode === "quantity" && (
              <div className="form-row">
                <Field label="每日目标">
                  <input
                    type="number"
                    name="target"
                    min="0.1"
                    max="100000"
                    step="0.1"
                    required
                    defaultValue={base?.target ?? 8}
                  />
                </Field>
                <Field label="单位">
                  <input
                    name="unit"
                    maxLength={20}
                    required
                    defaultValue={base?.unit ?? "杯"}
                  />
                </Field>
              </div>
            )}
            <p className="hint">每周执行日</p>
            <div className="weekday-toggle">
              {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => (
                <button
                  type="button"
                  aria-pressed={weekdays.includes(i)}
                  className={`chip ${weekdays.includes(i) ? "selected" : ""}`}
                  key={d}
                  onClick={() =>
                    setWeekdays(
                      weekdays.includes(i)
                        ? weekdays.filter((x) => x !== i)
                        : [...weekdays, i],
                    )
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "memo" && (
          <Field label="正文">
            <textarea
              name="body"
              rows={8}
              maxLength={100000}
              defaultValue={base?.body ?? ""}
              placeholder="先记下来，慢慢整理。"
            />
          </Field>
        )}
        {kind === "anniversary" && (
          <Field label="显示方式">
            <select name="mode" defaultValue={base?.mode ?? "since"}>
              <option value="since">已经过了多少天</option>
              <option value="until">距离这一天还有多久</option>
            </select>
          </Field>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function SessionEditor({
  entry,
  onClose,
}: {
  entry: OfKind<"session">;
  onClose: () => void;
}) {
  const { run } = useLife();
  const [error, setError] = useState("");
  return (
    <Modal title="修改学习记录" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const start = Number(form.get("start"));
          const minutes = Number(form.get("minutes"));
          if (!Number.isFinite(minutes) || minutes <= 0) {
            setError("请输入有效时长");
            return;
          }
          if (
            await run(
              () =>
                service.save(
                  {
                    ...entry,
                    segments: [{ start, end: start + minutes * 60000 }],
                  },
                  entry.updatedAt,
                ),
              "已保存",
            )
          )
            onClose();
        }}
      >
        <p className="hint">
          修改后按起始时间与实际专注总时长重新计算每日统计。
        </p>
        <input
          type="hidden"
          name="start"
          value={entry.segments[0]?.start ?? Date.now()}
        />
        <Field label="专注时长（分钟）">
          <input
            name="minutes"
            type="number"
            min="0.1"
            max="1440"
            step="0.1"
            defaultValue={(
              entry.segments.reduce((n, s) => n + s.end - s.start, 0) / 60000
            ).toFixed(1)}
            required
          />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}
