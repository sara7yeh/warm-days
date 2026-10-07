import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "日期无效");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const metaFields = {
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
const positive = z.number().positive().max(100000);
const reminders = z
  .array(z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]))
  .max(4);
const eventFields = {
  title: z.string().trim().min(1).max(200),
  date: dateSchema,
  time: timeSchema.optional(),
  endTime: timeSchema.optional(),
  category: z.string().min(1).max(50),
  notes: z.string().max(20000),
  reminders,
};
export const eventSchema = z
  .object({
    ...metaFields,
    kind: z.literal("event"),
    ...eventFields,
    repeat: z.boolean(),
    until: dateSchema.optional(),
  })
  .strict()
  .refine(
    (x) => !x.repeat || (!!x.until && x.until >= x.date),
    "重复课程需要有效的结束日期",
  )
  .refine(
    (x) => !x.endTime || (!!x.time && x.endTime > x.time),
    "结束时间须晚于开始时间",
  );
const overrideSchema = z
  .object({
    ...eventFields,
    time: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
  })
  .partial()
  .strict();
export const recordSchema = z.union([
  eventSchema,
  z
    .object({
      ...metaFields,
      kind: z.literal("instance"),
      eventId: z.string().uuid(),
      occurrenceDate: dateSchema,
      done: z.boolean(),
      cancelled: z.boolean(),
      override: overrideSchema,
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("task"),
      title: z.string().trim().min(1).max(200),
      category: z.string().min(1).max(50),
      date: dateSchema.optional(),
      notes: z.string().max(20000),
      done: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("health"),
      date: dateSchema,
      exercised: z.boolean(),
      exercise: z.string().max(2000),
      food: z.string().max(5000),
      weight: positive.optional(),
      measures: z.record(z.string().min(1).max(30), positive),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("habit"),
      title: z.string().trim().min(1).max(100),
      mode: z.enum(["check", "quantity"]),
      target: positive,
      unit: z.string().max(20),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      startDate: dateSchema,
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("checkin"),
      habitId: z.string().uuid(),
      date: dateSchema,
      value: z.number().min(0).max(100000),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("journal"),
      date: dateSchema,
      body: z.string().max(100000),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("memo"),
      title: z.string().trim().min(1).max(200),
      body: z.string().max(100000),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("anniversary"),
      title: z.string().trim().min(1).max(100),
      date: dateSchema,
      mode: z.enum(["since", "until"]),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("session"),
      segments: z
        .array(
          z
            .object({ start: z.number().finite(), end: z.number().finite() })
            .strict()
            .refine((s) => s.end >= s.start),
        )
        .max(10000),
    })
    .strict(),
  z
    .object({
      ...metaFields,
      kind: z.literal("receipt"),
      key: z.string().max(300),
      acknowledged: z.boolean(),
    })
    .strict(),
]);
export type Entry = z.infer<typeof recordSchema>;
export type Kind = Entry["kind"];
export type OfKind<K extends Kind> = Extract<Entry, { kind: K }>;
export type Event = OfKind<"event">;
export type Instance = OfKind<"instance">;
export type ReminderHour = 1 | 3 | 5 | 7;
export const settingsSchema = z
  .object({
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "时区无效"),
    categories: z.array(z.string().trim().min(1).max(50)).min(1).max(100),
    reminderDefaults: reminders,
    focusMinutes: z.number().int().min(1).max(180),
    breakMinutes: z.number().int().min(1).max(60),
    longBreakMinutes: z.number().int().min(1).max(90),
  })
  .strict();
export const timerSchema = z
  .object({
    id: z.string().uuid(),
    phase: z.enum(["focus", "break", "longBreak"]),
    status: z.enum(["running", "paused"]),
    totalMs: z.number().positive(),
    elapsedMs: z.number().min(0),
    startedAt: z.number().nullable(),
    segments: z.array(
      z
        .object({ start: z.number().finite(), end: z.number().finite() })
        .strict()
        .refine((s) => s.end >= s.start),
    ),
    rounds: z.number().int().min(0),
  })
  .strict()
  .refine(
    (t) =>
      t.elapsedMs <= t.totalMs &&
      (t.status === "running" ? t.startedAt !== null : t.startedAt === null),
    "计时状态无效",
  );
export type Timer = z.infer<typeof timerSchema>;
export const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().min(0),
    settings: settingsSchema,
    entries: z.array(recordSchema).max(100000),
    timer: timerSchema.nullable(),
    rounds: z.number().int().min(0),
  })
  .strict();
export type State = z.infer<typeof stateSchema>;
export const defaultState = (): State => ({
  schemaVersion: 1,
  revision: 0,
  settings: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    categories: ["作业", "日常", "课程", "考试", "聚会"],
    reminderDefaults: [],
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
  },
  entries: [],
  timer: null,
  rounds: 0,
});
export function meta(id: string = crypto.randomUUID()) {
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now };
}
export function records<K extends Kind>(s: State, k: K): OfKind<K>[] {
  return s.entries.filter((e) => e.kind === k) as OfKind<K>[];
}
export function validateState(raw: unknown): State {
  const s = stateSchema.parse(raw);
  if (new Set(s.settings.categories).size !== s.settings.categories.length)
    throw new Error("分类重复");
  const ids = new Set<string>();
  const unique = new Set<string>();
  for (const e of s.entries) {
    if (ids.has(e.id)) throw new Error("备份含重复 ID");
    ids.add(e.id);
    let key = "";
    if (["health", "journal"].includes(e.kind))
      key = e.kind + ":" + (e as OfKind<"health">).date;
    if (e.kind === "instance") {
      const event = records(s, "event").find((x) => x.id === e.eventId);
      if (!event) throw new Error("日程关联缺失");
      const days =
        (Date.parse(e.occurrenceDate) - Date.parse(event.date)) / 86400000;
      if (
        days < 0 ||
        (event.repeat
          ? days % 7 !== 0 || e.occurrenceDate > event.until!
          : days !== 0)
      )
        throw new Error("重复日程关联无效");
      key = `instance:${e.eventId}:${e.occurrenceDate}`;
    }
    if (e.kind === "checkin") {
      if (!records(s, "habit").some((x) => x.id === e.habitId))
        throw new Error("打卡关联缺失");
      key = `check:${e.habitId}:${e.date}`;
    }
    if (e.kind === "receipt") key = "receipt:" + e.key;
    if (key) {
      if (unique.has(key)) throw new Error("备份包含重复日期或关联记录");
      unique.add(key);
    }
  }
  return s;
}
