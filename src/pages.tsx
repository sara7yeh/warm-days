import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Heart,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Flower2,
  Trash2,
  Check,
  BookOpen,
} from "lucide-react";
import { useLife, service } from "./context";
import { appNamespace } from "./storage";
import {
  type Entry,
  type OfKind,
  type ReminderHour,
  meta,
  records,
  settingsSchema,
} from "./model";
import { occurrences, elapsed, type Occurrence } from "./domain";
import {
  localDate,
  addDays,
  weekday,
  dayDiff,
  formatDate,
  splitSegments,
} from "./dates";
import {
  PageHead,
  Section,
  Empty,
  AddButton,
  EditButtons,
  CheckButton,
  Field,
  Chart,
  Modal,
} from "./ui";
import { Editor, SessionEditor } from "./editors";
export function RecordNav({ route }: { route: string }) {
  return (
    <div className="subnav">
      {[
        ["health", "身体记录"],
        ["habits", "习惯打卡"],
        ["study", "学习时光"],
        ["journal", "日记"],
        ["memos", "备忘录"],
      ].map(([id, title]) => (
        <a className={route === id ? "active" : ""} href={`#/${id}`} key={id}>
          {title}
        </a>
      ))}
    </div>
  );
}
function useDelete() {
  const { run } = useLife();
  return (entry: Entry) => {
    if (
      confirm(
        entry.kind === "habit"
          ? "删除这个习惯及其全部打卡记录？"
          : "确定删除这条记录？",
      )
    )
      void run(() => service.remove(entry.id), "已删除");
  };
}
function OccurrenceRow({
  item,
  onEdit,
}: {
  item: Occurrence;
  onEdit: () => void;
}) {
  const { run } = useLife();
  return (
    <div className={`entry-row ${item.done ? "done" : ""}`}>
      <CheckButton
        checked={item.done}
        onClick={() =>
          void run(() =>
            service.setOccurrence(item.eventId, item.occurrenceDate, {
              done: !item.done,
            }),
          )
        }
        label={`${item.done ? "恢复" : "完成"}${item.title}`}
      />
      <div className="entry-body">
        <strong>{item.title}</strong>
        <small>
          {item.date} · {item.time ?? "全天"}
          {item.endTime ? `–${item.endTime}` : ""}
          <span className="pill">{item.category}</span>
        </small>
        {item.notes && <p>{item.notes}</p>}
      </div>
      <EditButtons
        onEdit={onEdit}
        onDelete={() => {
          if (confirm("取消本次日程？其他重复日程将保留。"))
            void run(
              () =>
                service.setOccurrence(item.eventId, item.occurrenceDate, {
                  cancelled: true,
                }),
              "已取消本次日程",
            );
        }}
      />
    </div>
  );
}
export function CalendarPage() {
  const { state, today, run } = useLife();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<Occurrence | null | undefined>();
  const [series, setSeries] = useState(false);
  const first = month + "-01";
  const start = addDays(first, -((weekday(first) + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const all = occurrences(state, days[0], days[41]);
  const selectedItems = occurrences(state, selected, selected);
  const changeMonth = (n: number) => {
    const d = new Date(first + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  return (
    <>
      <PageHead
        eyebrow="MAKE ROOM FOR WHAT MATTERS"
        title="把日子安排得刚刚好"
        description="重要的事，有约的日子，都在这里。"
        action={<AddButton onClick={() => setEditing(null)}>日程</AddButton>}
      />
      <div className="calendar-layout">
        <Section
          title="我的日历"
          aside={
            <button
              className="text-link"
              onClick={() => {
                setSelected(today);
                setMonth(today.slice(0, 7));
              }}
            >
              回到今天
            </button>
          }
        >
          <div className="toolbar">
            <div className="month-nav">
              <button
                className="icon-button"
                aria-label="上个月"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={19} />
              </button>
              <h2>{month.replace("-", " 年 ")} 月</h2>
              <button
                className="icon-button"
                aria-label="下个月"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
            <button className="text-link" onClick={() => setSeries(true)}>
              管理重复课程
            </button>
          </div>
          <div className="calendar-grid">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div className="weekday" key={d}>
                {d}
              </div>
            ))}
            {days.map((d) => (
              <button
                key={d}
                aria-label={d}
                aria-pressed={selected === d}
                className={`day-cell ${d.slice(0, 7) !== month ? "outside" : ""} ${d === today ? "is-today" : ""} ${d === selected ? "selected" : ""}`}
                onClick={() => setSelected(d)}
              >
                <span>{Number(d.slice(-2))}</span>
                <span
                  className={`day-dot ${all.some((i) => i.date === d) ? "" : "empty-dot"}`}
                />
              </button>
            ))}
          </div>
          <p className="calendar-note">小圆点代表这一天有安排。</p>
        </Section>
        <Section
          title={formatDate(selected)}
          aside={
            <button
              className="icon-button"
              aria-label="为选中日期添加日程"
              onClick={() => setEditing(null)}
            >
              <Plus size={19} />
            </button>
          }
        >
          {selectedItems.length ? (
            selectedItems.map((item) => (
              <OccurrenceRow
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
              />
            ))
          ) : (
            <Empty
              text="这一天还没有安排"
              action="记下一件事"
              onAdd={() => setEditing(null)}
            />
          )}
        </Section>
      </div>
      {editing !== undefined && (
        <Editor
          kind="event"
          date={selected}
          occurrence={editing ?? undefined}
          entry={
            editing
              ? records(state, "event").find((e) => e.id === editing.eventId)
              : undefined
          }
          onClose={() => setEditing(undefined)}
        />
      )}{" "}
      {series && (
        <Modal title="重复课程" onClose={() => setSeries(false)}>
          {records(state, "event").filter((e) => e.repeat).length ? (
            records(state, "event")
              .filter((e) => e.repeat)
              .map((e) => (
                <div className="entry-row" key={e.id}>
                  <div className="entry-body">
                    <strong>{e.title}</strong>
                    <small>
                      {e.date} 至 {e.until} · 每周
                      {"日一二三四五六"[weekday(e.date)]}
                    </small>
                  </div>
                  <button
                    className="icon-button danger"
                    aria-label={`删除整个${e.title}系列`}
                    onClick={() => {
                      if (confirm("删除整组课程及其完成历史？"))
                        void run(() => service.remove(e.id), "整组课程已删除");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
          ) : (
            <Empty text="还没有重复课程" />
          )}
        </Modal>
      )}
    </>
  );
}
export function TasksPage() {
  const { state, today, run } = useLife();
  const [category, setCategory] = useState("全部");
  const [range, setRange] = useState("near");
  const [edit, setEdit] = useState<OfKind<"task"> | null | undefined>();
  const [eventEdit, setEventEdit] = useState<Occurrence>();
  const remove = useDelete();
  const dates = [
    ...records(state, "event").flatMap((e) => [e.date, e.until ?? e.date]),
    ...records(state, "instance").flatMap((e) =>
      e.override.date ? [e.override.date] : [],
    ),
  ];
  const from =
    range === "today" ? today : dates.reduce((a, d) => (d < a ? d : a), today);
  const to =
    range === "today"
      ? today
      : range === "near"
        ? addDays(today, 7)
        : dates.reduce((a, d) => (d > a ? d : a), today);
  const events = occurrences(state, from, to).filter(
    (i) => category === "全部" || i.category === category,
  );
  const tasks = records(state, "task").filter(
    (t) =>
      (category === "全部" || t.category === category) &&
      (range === "all" ||
        !t.date ||
        (range === "today" ? t.date === today : t.date <= to)),
  );
  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const row = (t: OfKind<"task">) => (
    <div className={`entry-row ${t.done ? "done" : ""}`} key={t.id}>
      <CheckButton
        checked={t.done}
        label={`${t.done ? "恢复" : "完成"}${t.title}`}
        onClick={() =>
          void run(() => service.save({ ...t, done: !t.done }, t.updatedAt))
        }
      />
      <div className="entry-body">
        <strong>{t.title}</strong>
        <small>
          {t.date ?? "不限日期"}
          <span className="pill">{t.category}</span>
        </small>
        {t.notes && <p>{t.notes}</p>}
      </div>
      <EditButtons onEdit={() => setEdit(t)} onDelete={() => remove(t)} />
    </div>
  );
  return (
    <>
      <PageHead
        eyebrow="ONE THING AT A TIME"
        title="一件一件，慢慢完成"
        description="完成之后，给自己一个小小的肯定。"
        action={<AddButton onClick={() => setEdit(null)}>待办</AddButton>}
      />
      <div className="toolbar">
        <div className="chips">
          {["全部", ...state.settings.categories].map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? "selected" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          aria-label="待办日期范围"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="near">逾期及未来7天</option>
          <option value="today">仅今天</option>
          <option value="all">全部日期</option>
        </select>
      </div>
      <Section
        title={`待完成 · ${active.length + events.filter((i) => !i.done).length}`}
      >
        {active.map(row)}
        {events
          .filter((i) => !i.done)
          .map((i) => (
            <OccurrenceRow key={i.id} item={i} onEdit={() => setEventEdit(i)} />
          ))}
        {!active.length && !events.some((i) => !i.done) && (
          <Empty text="此刻的清单很轻，给自己一点休息吧" />
        )}
        <details className="completed">
          <summary>
            已完成 · {done.length + events.filter((i) => i.done).length}
          </summary>
          {done.map(row)}
          {events
            .filter((i) => i.done)
            .map((i) => (
              <OccurrenceRow
                key={i.id}
                item={i}
                onEdit={() => setEventEdit(i)}
              />
            ))}
        </details>
      </Section>
      <p className="hint">
        带日程时间的事项与日历共用一条记录，完成后仍会留在日历中。
      </p>
      {edit !== undefined && (
        <Editor
          kind="task"
          entry={edit ?? undefined}
          onClose={() => setEdit(undefined)}
        />
      )}{" "}
      {eventEdit && (
        <Editor
          kind="event"
          entry={records(state, "event").find(
            (e) => e.id === eventEdit.eventId,
          )}
          occurrence={eventEdit}
          onClose={() => setEventEdit(undefined)}
        />
      )}
    </>
  );
}
export function HealthPage() {
  const { state, today } = useLife();
  const [edit, setEdit] = useState<OfKind<"health"> | null | undefined>();
  const [metric, setMetric] = useState("weight");
  const [range, setRange] = useState("30");
  const remove = useDelete();
  const all = records(state, "health").sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const measures = Array.from(
    new Set(all.flatMap((e) => Object.keys(e.measures))),
  );
  const filtered = all.filter(
    (e) => range === "all" || e.date >= addDays(today, -Number(range) + 1),
  );
  const points = filtered.flatMap((e) => {
    const value = metric === "weight" ? e.weight : e.measures[metric];
    return value === undefined ? [] : [{ date: e.date, value }];
  });
  const latestWeight = all.filter((e) => e.weight !== undefined).at(-1);
  const thisMonth = all.filter(
    (e) => e.date.startsWith(today.slice(0, 7)) && e.exercised,
  );
  return (
    <>
      <PageHead
        eyebrow="TAKE GOOD CARE OF YOURSELF"
        title="和身体，好好相处"
        description="每一点变化，都值得温柔对待。"
        action={
          <AddButton
            onClick={() => setEdit(all.find((e) => e.date === today) ?? null)}
          >
            记录
          </AddButton>
        }
      />
      <RecordNav route="health" />
      <div className="metric-grid">
        <div className="metric">
          <span>最近体重</span>
          <strong>{latestWeight?.weight ?? "—"}</strong>
          <small>
            {latestWeight ? `${latestWeight.date} · kg` : "等待第一次记录"}
          </small>
        </div>
        <div className="metric">
          <span>本月运动</span>
          <strong>{thisMonth.length}</strong>
          <small>天 · 每次都算数</small>
        </div>
        <div className="metric">
          <span>身体记录</span>
          <strong>{all.length}</strong>
          <small>天 · 认识自己</small>
        </div>
      </div>
      <div className="stack">
        <Section
          title="看得见的变化"
          aside={
            <div className="chart-selects">
              <select
                aria-label="趋势指标"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="weight">体重</option>
                {measures.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <select
                aria-label="健康趋势范围"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="30">近30天</option>
                <option value="90">近90天</option>
                <option value="all">全部</option>
              </select>
            </div>
          }
        >
          <Chart points={points} unit={metric === "weight" ? "kg" : "cm"} />
        </Section>
        <Section title="身体日记">
          {[...all].reverse().map((e) => (
            <article className="health-row" key={e.id}>
              <header>
                <strong>{e.date}</strong>
                <span className="pill">
                  {e.exercised ? "运动了" : "休息日"}
                </span>
                <EditButtons
                  onEdit={() => setEdit(e)}
                  onDelete={() => remove(e)}
                />
              </header>
              {e.exercise && <p>运动 · {e.exercise}</p>}
              {e.food && <p>饮食 · {e.food}</p>}
              <p>
                {e.weight !== undefined ? `体重 ${e.weight} kg　` : ""}
                {Object.entries(e.measures)
                  .map(([name, value]) => `${name} ${value} cm`)
                  .join("　")}
              </p>
            </article>
          ))}
          {!all.length && (
            <Empty text="今天的你，感觉怎么样？" onAdd={() => setEdit(null)} />
          )}
        </Section>
      </div>
      {edit !== undefined && (
        <Editor
          kind="health"
          entry={edit ?? undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
function HabitRow({
  habit,
  date,
  onEdit,
}: {
  habit: OfKind<"habit">;
  date: string;
  onEdit: () => void;
}) {
  const { state, run } = useLife();
  const saved =
    records(state, "checkin").find(
      (e) => e.habitId === habit.id && e.date === date,
    )?.value ?? 0;
  const [value, setValue] = useState(String(saved));
  useEffect(() => setValue(String(saved)), [saved, date]);
  const remove = useDelete();
  const done = saved >= habit.target;
  return (
    <div className="habit-row">
      <CheckButton
        checked={done}
        label={`完成${habit.title}`}
        onClick={() =>
          void run(() =>
            service.checkin(habit.id, date, done ? 0 : habit.target),
          )
        }
      />
      <div className="habit-main">
        <strong>{habit.title}</strong>
        <p>
          {habit.mode === "check"
            ? done
              ? "今天已完成"
              : "给今天一个小小的勾"
            : `${saved} / ${habit.target} ${habit.unit}`}
        </p>
        <div className="progress">
          <span
            style={{ width: `${Math.min(100, (saved / habit.target) * 100)}%` }}
          />
        </div>
        {habit.mode === "quantity" && (
          <form
            className="habit-input"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () => service.checkin(habit.id, date, Number(value)),
                "打卡已保存",
              );
            }}
          >
            <input
              type="number"
              aria-label={`${habit.title}数量`}
              min="0"
              max="100000"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <button className="text-link">记录 {habit.unit}</button>
          </form>
        )}
      </div>
      <EditButtons onEdit={onEdit} onDelete={() => remove(habit)} />
    </div>
  );
}
export function HabitsPage() {
  const { state, today, run } = useLife();
  const [date, setDate] = useState(today);
  const [edit, setEdit] = useState<OfKind<"habit"> | null | undefined>();
  const habits = records(state, "habit");
  const scheduled = habits.filter(
    (h) => h.weekdays.includes(weekday(date)) && h.startDate <= date,
  );
  const logs = records(state, "checkin").sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return (
    <>
      <PageHead
        eyebrow="LITTLE BY LITTLE"
        title="小习惯，慢慢长大"
        description="不必一下子改变很多，今天做一点就很好。"
        action={<AddButton onClick={() => setEdit(null)}>习惯</AddButton>}
      />
      <RecordNav route="habits" />
      <div className="toolbar">
        <span className="muted">{formatDate(date)}</span>
        <input
          aria-label="打卡日期"
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
      </div>
      <div className="stack">
        <Section title="这一天的小约定">
          {scheduled.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              date={date}
              onEdit={() => setEdit(h)}
            />
          ))}
          {!scheduled.length && (
            <Empty text="这一天没有安排习惯" onAdd={() => setEdit(null)} />
          )}
        </Section>
        {habits.some((h) => !scheduled.includes(h)) && (
          <Section title="其他习惯">
            {habits
              .filter((h) => !scheduled.includes(h))
              .map((h) => (
                <div className="entry-row" key={h.id}>
                  <div className="entry-body">
                    <strong>{h.title}</strong>
                    <small>
                      每周{" "}
                      {h.weekdays
                        .sort()
                        .map((d) => "日一二三四五六"[d])
                        .join("、")}
                    </small>
                  </div>
                  <EditButtons
                    onEdit={() => setEdit(h)}
                    onDelete={() => {
                      if (confirm("删除习惯及其打卡记录？"))
                        void run(() => service.remove(h.id));
                    }}
                  />
                </div>
              ))}
          </Section>
        )}
        <Section title="留下的坚持">
          {logs.length ? (
            <div className="data-scroll">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>习惯</th>
                    <th>记录</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((e) => {
                    const h = habits.find((h) => h.id === e.habitId)!;
                    return (
                      <tr key={e.id}>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => setDate(e.date)}
                          >
                            {e.date}
                          </button>
                        </td>
                        <td>{h.title}</td>
                        <td>
                          {h.mode === "check"
                            ? e.value >= 1
                              ? "已完成"
                              : "未完成"
                            : `${e.value} ${h.unit}`}
                        </td>
                        <td>
                          <button
                            className="icon-button danger"
                            aria-label={`删除${e.date}${h.title}打卡`}
                            onClick={() => {
                              if (confirm("删除这次打卡记录？"))
                                void run(
                                  () => service.remove(e.id),
                                  "打卡已删除",
                                );
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="你的每一次坚持，都会留在这里" />
          )}
        </Section>
      </div>
      {edit !== undefined && (
        <Editor
          kind="habit"
          entry={edit ?? undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
export function TimerWatcher() {
  const { state, run, notify } = useLife();
  const busy = useRef(false);
  useEffect(() => {
    const check = () => {
      const t = state.timer;
      if (t?.status === "running" && elapsed(t) >= t.totalMs && !busy.current) {
        busy.current = true;
        void run(() => service.timerAction("finish", t.id))
          .then((ok) => {
            if (ok)
              notify(
                t.phase === "focus"
                  ? "这段专注完成了，伸个懒腰吧。"
                  : "休息结束，准备好再开始。",
              );
          })
          .finally(() => (busy.current = false));
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [state.timer]);
  return null;
}
export function StudyPage() {
  const { state, today, run } = useLife();
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<"focus" | "break" | "longBreak">("focus");
  const [range, setRange] = useState(7);
  const [edit, setEdit] = useState<OfKind<"session">>();
  const remove = useDelete();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const previousTimer = useRef(state.timer);
  useEffect(() => {
    const previous = previousTimer.current;
    if (previous && !state.timer && elapsed(previous) >= previous.totalMs) {
      setPhase(
        previous.phase === "focus"
          ? state.rounds > 0 && state.rounds % 4 === 0
            ? "longBreak"
            : "break"
          : "focus",
      );
    }
    previousTimer.current = state.timer;
  }, [state.timer, state.rounds]);
  const t = state.timer;
  const activePhase = t?.phase ?? phase;
  const duration =
    (activePhase === "focus"
      ? state.settings.focusMinutes
      : activePhase === "break"
        ? state.settings.breakMinutes
        : state.settings.longBreakMinutes) * 60000;
  const remaining = t ? Math.max(0, t.totalMs - elapsed(t, now)) : duration;
  const seconds = Math.ceil(remaining / 1000);
  const sessions = records(state, "session");
  const totals = splitSegments(
    sessions.flatMap((s) => s.segments),
    state.settings.timezone,
  );
  const points = Array.from({ length: range }, (_, i) => {
    const date = addDays(today, i - range + 1);
    return { date, value: totals[date] ?? 0 };
  });
  return (
    <>
      <PageHead
        eyebrow="A MOMENT OF FOCUS"
        title="现在，只做这一件事"
        description="把注意力收回来，留一段安静的时光。"
      />
      <RecordNav route="study" />
      <div className="timer-layout">
        <div className="timer-card">
          <div className="chips">
            {(["focus", "break", "longBreak"] as const).map((p, i) => (
              <button
                className={`chip ${activePhase === p ? "selected" : ""}`}
                disabled={!!t}
                key={p}
                onClick={() => setPhase(p)}
              >
                {["专注", "短休息", "长休息"][i]}
              </button>
            ))}
          </div>
          <div className="timer-face">
            <strong>
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </strong>
            <span>
              {t
                ? t.status === "paused"
                  ? "暂停一下，也没关系"
                  : "专心此刻"
                : "准备好，就开始吧"}
            </span>
          </div>
          <div className="timer-controls">
            {!t ? (
              <button
                className="primary"
                onClick={() => void run(() => service.startTimer(phase))}
              >
                <Play size={17} />
                开始{phase === "focus" ? "专注" : "休息"}
              </button>
            ) : (
              <>
                <button
                  className="primary"
                  onClick={() =>
                    void run(() =>
                      service.timerAction(
                        t.status === "running" ? "pause" : "resume",
                        t.id,
                      ),
                    )
                  }
                >
                  {t.status === "running" ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}{" "}
                  {t.status === "running" ? "暂停" : "继续"}
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    void run(
                      () => service.timerAction("finish", t.id),
                      "本段记录已保存",
                    )
                  }
                >
                  结束{t.phase === "focus" ? "并保存" : ""}
                </button>
                <button
                  className="icon-button"
                  aria-label="放弃本轮计时"
                  onClick={() => {
                    if (confirm("放弃本轮计时，不保存本轮专注时长？"))
                      void run(() => service.timerAction("discard", t.id));
                  }}
                >
                  <RotateCcw size={18} />
                </button>
              </>
            )}
          </div>
          <p className="hint">
            已完成 {state.rounds} 轮 ·{" "}
            {state.rounds > 0 && state.rounds % 4 === 0
              ? "可以享受一次长休息"
              : "每4轮，给自己一段长休息"}
          </p>
          <a className="text-link" href="#/settings">
            调整专注与休息时长
          </a>
        </div>
        <Section
          title="积累的每一分钟"
          aside={
            <select
              aria-label="学习趋势范围"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            >
              <option value={7}>近7天</option>
              <option value={30}>近30天</option>
            </select>
          }
        >
          <div className="metric">
            <span>今天已学习</span>
            <strong>{(totals[today] ?? 0).toFixed(1)}</strong>
            <small>分钟 · 已保存的专注时长</small>
          </div>
          <Chart points={points} unit="分钟" color="#8b986f" />
        </Section>
      </div>
      <Section title="专注足迹" className="completed">
        {[...sessions].reverse().map((s) => (
          <div className="entry-row" key={s.id}>
            <BookOpen size={18} />
            <div className="entry-body">
              <strong>
                {(
                  s.segments.reduce((n, x) => n + x.end - x.start, 0) / 60000
                ).toFixed(1)}{" "}
                分钟
              </strong>
              <small>
                {s.segments[0]
                  ? new Intl.DateTimeFormat("zh-CN", {
                      timeZone: state.settings.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(s.segments[0].start)
                  : ""}
              </small>
            </div>
            <EditButtons onEdit={() => setEdit(s)} onDelete={() => remove(s)} />
          </div>
        ))}
        {!sessions.length && <Empty text="从第一段专注开始，时间会给你答案" />}
      </Section>
      {edit && (
        <SessionEditor entry={edit} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
export function JournalPage() {
  const { state, today, notify } = useLife();
  const [date, setDate] = useState(today);
  return (
    <>
      <PageHead
        eyebrow="DEAR ME"
        title="今天，想对自己说些什么？"
        description="不用写得漂亮，在这里做自己就好。"
      />
      <RecordNav route="journal" />
      <JournalPaper key={date} date={date} onDate={setDate} />
      <Section title="翻翻旧日子" className="completed">
        <div className="chips">
          {records(state, "journal")
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((j) => (
              <button
                className={`chip ${j.date === date ? "selected" : ""}`}
                key={j.id}
                onClick={() => {
                  if (j.date !== date) {
                    setDate(j.date);
                    notify("已翻到 " + j.date);
                  }
                }}
              >
                {j.date}
              </button>
            ))}
        </div>
        {!records(state, "journal").length && (
          <Empty text="写下第一句，今天就有了自己的书签" />
        )}
      </Section>
    </>
  );
}
function JournalPaper({
  date,
  onDate,
}: {
  date: string;
  onDate: (d: string) => void;
}) {
  const { state, run } = useLife();
  const original = records(state, "journal").find((j) => j.date === date);
  const draftKey = `${appNamespace}:journal-draft:${date}`;
  const [body, setBody] = useState(() => {
    try {
      return localStorage.getItem(draftKey) ?? original?.body ?? "";
    } catch {
      return original?.body ?? "";
    }
  });
  const [status, setStatus] = useState(
    body !== (original?.body ?? "") ? "已恢复未保存草稿" : "",
  );
  const [dirty, setDirty] = useState(body !== (original?.body ?? ""));
  const current = useRef(original);
  const bodyRef = useRef(body);
  const savedRef = useRef(original?.body ?? "");
  const saving = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (!dirty) {
      current.current = original;
      setBody(original?.body ?? "");
      bodyRef.current = original?.body ?? "";
      savedRef.current = original?.body ?? "";
    }
  }, [original?.updatedAt]);
  async function save() {
    if (saving.current) return saving.current;
    if (bodyRef.current === savedRef.current) return true;
    const value = bodyRef.current;
    setStatus("正在保存…");
    const entry: OfKind<"journal"> = {
      ...meta(),
      ...current.current,
      kind: "journal",
      date,
      body: value,
    };
    const promise = run(() => service.save(entry, current.current?.updatedAt));
    saving.current = promise;
    const ok = await promise;
    if (ok) {
      const fresh = await service.repository.load();
      current.current = records(fresh, "journal").find((j) => j.date === date);
      savedRef.current = value;
      if (bodyRef.current === value) {
        setDirty(false);
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }
      setStatus("已保存在本机");
    } else setStatus("保存失败，草稿已保留。点击重试");
    saving.current = null;
    return ok;
  }
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), 800);
    return () => clearTimeout(t);
  }, [body, dirty]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (bodyRef.current !== savedRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      window.removeEventListener("beforeunload", before);
      void save();
    };
  }, []);
  return (
    <article className="journal-paper">
      <header>
        <input
          aria-label="日记日期"
          type="date"
          value={date}
          onChange={async (e) => {
            const next = e.target.value;
            if (next && (await save())) onDate(next);
          }}
        />
        <button className="save-state" onClick={() => void save()}>
          {status || "只在你的浏览器中保存"}
        </button>
      </header>
      <textarea
        aria-label="日记正文"
        placeholder="亲爱的自己，\n今天过得怎么样？"
        value={body}
        maxLength={100000}
        onChange={(e) => {
          const value = e.target.value;
          setBody(value);
          bodyRef.current = value;
          setDirty(true);
          setStatus("尚未保存");
          try {
            localStorage.setItem(draftKey, value);
          } catch {
            setStatus("草稿空间不足，请及时保存");
          }
        }}
      />
      <div className="journal-bottom">
        <span>{body.length} 字 · 写多少都好</span>
        <button
          className="icon-button danger"
          aria-label="删除这篇日记"
          onClick={async () => {
            if (!confirm("删除这一天的日记？")) return;
            await saving.current;
            if (
              current.current &&
              !(await run(() => service.remove(current.current!.id)))
            )
              return;
            current.current = undefined;
            savedRef.current = "";
            bodyRef.current = "";
            setBody("");
            setDirty(false);
            setStatus("已删除");
            try {
              localStorage.removeItem(draftKey);
            } catch {}
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
export function MemosPage() {
  const { state } = useLife();
  const [edit, setEdit] = useState<OfKind<"memo"> | null | undefined>();
  const remove = useDelete();
  const all = records(state, "memo").sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <>
      <PageHead
        eyebrow="KEEP THAT LITTLE THOUGHT"
        title="想到什么，就记下来"
        description="灵感、清单，或一句想留住的话。"
        action={<AddButton onClick={() => setEdit(null)}>备忘</AddButton>}
      />
      <RecordNav route="memos" />
      {all.length ? (
        <div className="memo-grid">
          {all.map((m) => (
            <article className="memo-card" key={m.id}>
              <h2>{m.title}</h2>
              <p>{m.body || "还没有写下内容。"}</p>
              <footer>
                <span>
                  {localDate(Date.parse(m.updatedAt), state.settings.timezone)}
                </span>
                <EditButtons
                  onEdit={() => setEdit(m)}
                  onDelete={() => remove(m)}
                />
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <Section title="我的随手记">
          <Empty
            text="一闪而过的念头，也值得留下"
            onAdd={() => setEdit(null)}
          />
        </Section>
      )}
      {edit !== undefined && (
        <Editor
          kind="memo"
          entry={edit ?? undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
export function AnniversariesPage() {
  const { state, today } = useLife();
  const [edit, setEdit] = useState<OfKind<"anniversary"> | null | undefined>();
  const remove = useDelete();
  const all = records(state, "anniversary");
  return (
    <>
      <PageHead
        eyebrow="SOME DAYS ARE SPECIAL"
        title="值得记住的日子"
        description="有些期待，有些陪伴，时间都记得。"
        action={<AddButton onClick={() => setEdit(null)}>纪念日</AddButton>}
      />
      {all.length ? (
        <div className="anniversary-grid">
          {all.map((e) => {
            const diff = dayDiff(today, e.date);
            return (
              <article className="anniversary" key={e.id}>
                <Heart size={22} />
                <h2>{e.title}</h2>
                <p>
                  {e.mode === "since"
                    ? diff < 0
                      ? "距离开始还有"
                      : "已经一起走过"
                    : diff > 0
                      ? "已经过去"
                      : diff === 0
                        ? "就是今天"
                        : "还有"}
                </p>
                <div className="days">
                  {Math.abs(diff)} <small>天</small>
                </div>
                <p>
                  {e.date} · {e.mode === "since" ? "记录陪伴" : "记录期待"}
                </p>
                <EditButtons
                  onEdit={() => setEdit(e)}
                  onDelete={() => remove(e)}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <Section title="珍藏的日子">
          <Empty
            text="为一个特别的日子，留一张小卡片"
            onAdd={() => setEdit(null)}
          />
        </Section>
      )}
      {edit !== undefined && (
        <Editor
          kind="anniversary"
          entry={edit ?? undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
export function SettingsPage() {
  const { state, run, notify } = useLife();
  const [category, setCategory] = useState("");
  const [pending, setPending] =
    useState<ReturnType<typeof service.parseBackup>>();
  const [reminders, setReminders] = useState(state.settings.reminderDefaults);
  const [error, setError] = useState("");
  async function settings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const next = settingsSchema.parse({
        ...state.settings,
        timezone: String(f.get("timezone")),
        focusMinutes: Number(f.get("focus")),
        breakMinutes: Number(f.get("break")),
        longBreakMinutes: Number(f.get("longBreak")),
        reminderDefaults: reminders,
      });
      await run(
        () =>
          service.update((s) => {
            s.settings = { ...next, categories: s.settings.categories };
          }),
        "设置已保存",
      );
      setError("");
    } catch {
      setError("请检查时区与时长，时区示例：Asia/Shanghai");
    }
  }
  async function exportBackup() {
    try {
      const text = await service.export();
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `暖日备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify("备份已导出，请妥善保存");
    } catch {
      notify("导出失败，请重试");
    }
  }
  return (
    <>
      <PageHead
        eyebrow="YOUR OWN LITTLE CORNER"
        title="我的小空间"
        description="按自己的习惯，安排每一天。"
      />
      <a href="#/anniversaries" className="game-intro">
        <Heart size={28} />
        <div>
          <h2>值得记住的日子</h2>
          <p>倒数期待，记录陪伴。</p>
        </div>
        <ChevronRight size={20} style={{ marginLeft: "auto" }} />
      </a>
      <div className="settings-grid">
        <Section title="日常偏好">
          <form onSubmit={settings}>
            <Field label="时区">
              <input
                name="timezone"
                defaultValue={state.settings.timezone}
                list="timezones"
                required
              />
              <datalist id="timezones">
                {[
                  "Asia/Shanghai",
                  "Asia/Hong_Kong",
                  "Asia/Taipei",
                  "America/Los_Angeles",
                  "America/New_York",
                  "Europe/London",
                  "Asia/Tokyo",
                  "Australia/Sydney",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </datalist>
            </Field>
            <div className="form-row">
              <Field label="专注时长（分钟）">
                <input
                  type="number"
                  name="focus"
                  min="1"
                  max="180"
                  required
                  defaultValue={state.settings.focusMinutes}
                />
              </Field>
              <Field label="短休息（分钟）">
                <input
                  type="number"
                  name="break"
                  min="1"
                  max="60"
                  required
                  defaultValue={state.settings.breakMinutes}
                />
              </Field>
            </div>
            <Field label="长休息（分钟）">
              <input
                type="number"
                name="longBreak"
                min="1"
                max="90"
                required
                defaultValue={state.settings.longBreakMinutes}
              />
            </Field>
            <Field label="新日程默认提前提醒">
              <div className="chips">
                {([1, 3, 5, 7] as ReminderHour[]).map((h) => (
                  <button
                    type="button"
                    aria-label={`提前${h}小时`}
                    aria-pressed={reminders.includes(h)}
                    className={`chip ${reminders.includes(h) ? "selected" : ""}`}
                    key={h}
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
              仅日期事项以23:59为基准。关闭网站或锁屏时，站内提醒可能无法触发。
            </p>
            {error && <p className="error">{error}</p>}
            <button className="primary" type="submit">
              保存偏好
            </button>
          </form>
        </Section>
        <Section title="我的分类">
          {state.settings.categories.map((c) => (
            <div className="category-row" key={c}>
              <span>{c}</span>
              <button
                className="icon-button"
                aria-label={`删除分类${c}`}
                onClick={() => {
                  if (state.settings.categories.length === 1) {
                    notify("至少保留一个分类");
                    return;
                  }
                  if (confirm(`删除“${c}”分类？原有事项将移至其他分类。`))
                    void run(
                      () =>
                        service.update((s) => {
                          s.settings.categories = s.settings.categories.filter(
                            (x) => x !== c,
                          );
                          const fallback = s.settings.categories[0];
                          for (const e of s.entries) {
                            if (
                              (e.kind === "event" || e.kind === "task") &&
                              e.category === c
                            )
                              e.category = fallback;
                            if (
                              e.kind === "instance" &&
                              e.override.category === c
                            )
                              e.override.category = fallback;
                          }
                        }),
                      "分类已删除",
                    );
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <form
            className="category-add"
            onSubmit={async (e) => {
              e.preventDefault();
              const value = category.trim();
              if (!value) return;
              if (
                await run(
                  () =>
                    service.update((s) => {
                      if (s.settings.categories.includes(value))
                        throw new Error("分类已存在");
                      s.settings.categories.push(value);
                    }),
                  "分类已添加",
                )
              )
                setCategory("");
            }}
          >
            <input
              aria-label="新分类名称"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="新分类名称"
              maxLength={50}
              required
            />
            <button className="soft-button" aria-label="添加分类">
              <Plus size={18} />
            </button>
          </form>
        </Section>
        <Section title="数据与备份" className="wide">
          <div className="notice">
            你的记录仅保存在当前浏览器，不会上传到
            GitHub。清理网站数据或更换设备前，请先导出备份。手机和电脑各自保存，网站更新不会主动清空记录。
          </div>
          <div className="backup-actions">
            <button className="primary" onClick={() => void exportBackup()}>
              <Download size={17} />
              导出完整备份
            </button>
            <label className="secondary file-button">
              <Upload size={17} />
              导入备份
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 25 * 1024 * 1024)
                      throw new Error("文件过大，请选择25MB以内的备份");
                    setPending(service.parseBackup(await file.text()));
                  } catch (err) {
                    notify(
                      err instanceof Error
                        ? `无法导入：${err.message}`
                        : "备份校验失败",
                    );
                  }
                }}
              />
            </label>
          </div>
          <p className="hint">
            当前保存 {state.entries.length}{" "}
            条数据。导入将整体替换，建议先导出当前记录。以后升级云端时，这份备份仍可用于迁移。
          </p>
        </Section>
      </div>
      {pending && (
        <Modal title="确认导入备份" onClose={() => setPending(undefined)}>
          <p>备份已通过格式与关联校验，共 {pending.entries.length} 条记录。</p>
          <div className="notice">
            导入会替换当前浏览器的全部记录与偏好。计时器将暂停，避免把离开期间算作学习。
          </div>
          <div className="chips" style={{ marginTop: 16 }}>
            {Array.from(new Set(pending.entries.map((e) => e.kind))).map(
              (k) => (
                <span className="pill" key={k}>
                  {
                    (
                      {
                        event: "日程",
                        instance: "日程状态",
                        task: "待办",
                        health: "身体记录",
                        habit: "习惯",
                        checkin: "打卡",
                        journal: "日记",
                        memo: "备忘录",
                        anniversary: "纪念日",
                        session: "学习记录",
                        receipt: "提醒状态",
                      } as Record<string, string>
                    )[k]
                  }{" "}
                  {pending.entries.filter((e) => e.kind === k).length}
                </span>
              ),
            )}
          </div>
          <div className="form-actions">
            <button className="secondary" onClick={() => void exportBackup()}>
              先备份当前数据
            </button>
            <button
              className="primary"
              onClick={async () => {
                if (await run(() => service.import(pending), "备份已导入")) {
                  setPending(undefined);
                  const prefix = `${appNamespace}:journal-draft:`;
                  try {
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith(prefix))
                      .forEach((k) => localStorage.removeItem(k));
                  } catch {}
                  location.reload();
                }
              }}
            >
              确认替换
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
