import { type DataRepository } from "./storage";
import {
  type Entry,
  type State,
  type Event,
  type Timer,
  meta,
  records,
  validateState,
} from "./model";
import { addDays } from "./dates";
import { instanceFor, settledTimer } from "./domain";
export class LifeService {
  constructor(public repository: DataRepository) {}
  async update(change: (s: State) => void) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = await this.repository.load();
      const revision = s.revision;
      change(s);
      if (await this.repository.commit(revision, s)) return;
    }
    throw new Error("其他标签页正在保存，请重试");
  }
  async save(entry: Entry, expectedUpdatedAt?: string) {
    await this.update((s) => {
      const old = s.entries.find((e) => e.id === entry.id);
      if (expectedUpdatedAt && old?.updatedAt !== expectedUpdatedAt)
        throw new Error("这条记录已在另一标签页修改，请保留草稿并刷新后重试");
      s.entries = s.entries.filter((e) => e.id !== entry.id);
      s.entries.push({
        ...entry,
        updatedAt: new Date(
          Math.max(Date.now(), old ? Date.parse(old.updatedAt) + 1 : 0),
        ).toISOString(),
      });
    });
  }
  async remove(id: string) {
    await this.update((s) => {
      s.entries = s.entries.filter(
        (e) =>
          e.id !== id &&
          !(e.kind === "instance" && e.eventId === id) &&
          !(e.kind === "checkin" && e.habitId === id),
      );
    });
  }
  async setOccurrence(
    eventId: string,
    date: string,
    patch: Partial<Extract<Entry, { kind: "instance" }>>,
  ) {
    await this.update((s) => {
      const old = instanceFor(s, eventId, date);
      const next = {
        ...meta(),
        kind: "instance" as const,
        eventId,
        occurrenceDate: date,
        done: false,
        cancelled: false,
        override: {},
        ...old,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      s.entries = s.entries.filter((e) => e.id !== next.id);
      s.entries.push(next);
    });
  }
  async editOccurrence(
    eventId: string,
    date: string,
    edited: Event,
    scope: "one" | "future",
  ) {
    await this.update((s) => {
      const old = records(s, "event").find((e) => e.id === eventId);
      if (!old) throw new Error("日程不存在");
      if (scope === "one") {
        const instance = instanceFor(s, eventId, date);
        const next = {
          ...meta(),
          kind: "instance" as const,
          eventId,
          occurrenceDate: date,
          done: false,
          cancelled: false,
          ...instance,
          override: {
            title: edited.title,
            date: edited.date,
            time: edited.time ?? null,
            endTime: edited.endTime ?? null,
            category: edited.category,
            notes: edited.notes,
            reminders: edited.reminders,
          },
          updatedAt: new Date().toISOString(),
        };
        s.entries = s.entries.filter((e) => e.id !== next.id);
        s.entries.push(next);
      } else {
        const isFirst = date === old.date;
        const newId = isFirst ? old.id : crypto.randomUUID();
        if (isFirst) {
          s.entries = s.entries.filter(
            (e) =>
              e.id !== old.id &&
              !(e.kind === "instance" && e.eventId === old.id),
          );
        } else {
          old.until = addDays(date, -1);
          old.updatedAt = new Date().toISOString();
          s.entries = s.entries.filter(
            (e) =>
              !(
                e.kind === "instance" &&
                e.eventId === old.id &&
                e.occurrenceDate >= date
              ),
          );
        }
        s.entries.push({
          ...edited,
          ...meta(newId),
          createdAt: isFirst ? old.createdAt : edited.createdAt,
        });
      }
    });
  }
  async checkin(habitId: string, date: string, value: number) {
    await this.update((s) => {
      const old = records(s, "checkin").find(
        (e) => e.habitId === habitId && e.date === date,
      );
      s.entries = s.entries.filter((e) => e.id !== old?.id);
      s.entries.push({
        ...meta(),
        ...old,
        kind: "checkin",
        habitId,
        date,
        value,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async acknowledge(keys: string[]) {
    await this.update((s) => {
      for (const key of keys) {
        const old = records(s, "receipt").find((x) => x.key === key);
        if (old) old.acknowledged = true;
        else
          s.entries.push({
            ...meta(),
            kind: "receipt",
            key,
            acknowledged: true,
          });
      }
    });
  }
  async startTimer(phase: Timer["phase"]) {
    await this.update((s) => {
      if (s.timer) throw new Error("已有进行中的计时");
      const minutes =
        phase === "focus"
          ? s.settings.focusMinutes
          : phase === "break"
            ? s.settings.breakMinutes
            : s.settings.longBreakMinutes;
      s.timer = {
        id: crypto.randomUUID(),
        phase,
        status: "running",
        totalMs: minutes * 60000,
        elapsedMs: 0,
        startedAt: Date.now(),
        segments: [],
        rounds: s.rounds,
      };
    });
  }
  async timerAction(
    action: "pause" | "resume" | "finish" | "discard",
    id: string,
  ) {
    await this.update((s) => {
      if (!s.timer || s.timer.id !== id) return;
      if (action === "resume") {
        if (s.timer.status === "paused")
          s.timer = { ...s.timer, status: "running", startedAt: Date.now() };
        return;
      }
      const timer = settledTimer(s.timer);
      if (action === "pause") {
        s.timer = timer;
        return;
      }
      if (action === "finish" && timer.phase === "focus") {
        if (timer.segments.length && !s.entries.some((e) => e.id === timer.id))
          s.entries.push({
            ...meta(timer.id),
            kind: "session",
            segments: timer.segments,
          });
        if (timer.elapsedMs >= timer.totalMs) s.rounds++;
      }
      s.timer = null;
    });
  }
  async export() {
    return JSON.stringify(
      {
        app: "warm-days",
        exportedAt: new Date().toISOString(),
        data: await this.repository.load(),
      },
      null,
      2,
    );
  }
  parseBackup(text: string) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("不是有效的 JSON 文件");
    }
    if (raw?.app !== "warm-days") throw new Error("不是暖日备份文件");
    return validateState(raw.data);
  }
  async import(data: State) {
    const valid = validateState(data);
    await this.update((s) => {
      const revision = s.revision;
      Object.assign(s, structuredClone(valid), { revision });
      if (s.timer)
        s.timer = settledTimer(s.timer, s.timer.startedAt ?? Date.now());
    });
  }
}
