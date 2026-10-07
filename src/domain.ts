import {
  type State,
  type Event,
  type Instance,
  type Timer,
  records,
} from "./model";
import { addDays, dayDiff, zonedTime } from "./dates";
export type Occurrence = Omit<Event, "id"> & {
  id: string;
  eventId: string;
  occurrenceDate: string;
  done: boolean;
};
export function occurrences(s: State, from: string, to: string): Occurrence[] {
  const result: Occurrence[] = [];
  const overrides = records(s, "instance");
  for (const event of records(s, "event")) {
    const dates = new Set<string>();
    const last = event.repeat ? event.until! : event.date;
    let start = event.date;
    if (event.repeat && from > start)
      start = addDays(
        start,
        Math.max(0, Math.ceil(dayDiff(from, start) / 7)) * 7,
      );
    for (let d = start; d <= last && d <= to; d = addDays(d, 7)) {
      if (d >= from) dates.add(d);
      if (!event.repeat) break;
    }
    for (const i of overrides.filter((x) => x.eventId === event.id))
      if (i.override.date && i.override.date >= from && i.override.date <= to)
        dates.add(i.occurrenceDate);
    for (const date of dates) {
      const instance = overrides.find(
        (x) => x.eventId === event.id && x.occurrenceDate === date,
      );
      if (instance?.cancelled) continue;
      const item = {
        ...event,
        date,
        ...instance?.override,
        id: `${event.id}:${date}`,
        eventId: event.id,
        occurrenceDate: date,
        done: instance?.done ?? false,
      };
      const normalized = {
        ...item,
        time: item.time ?? undefined,
        endTime: item.endTime ?? undefined,
      };
      if (item.date >= from && item.date <= to) result.push(normalized);
    }
  }
  return result.sort((a, b) =>
    `${a.date}${a.time ?? "23:59"}`.localeCompare(
      `${b.date}${b.time ?? "23:59"}`,
    ),
  );
}
export function instanceFor(
  s: State,
  eventId: string,
  date: string,
): Instance | undefined {
  return records(s, "instance").find(
    (x) => x.eventId === eventId && x.occurrenceDate === date,
  );
}
export function elapsed(timer: Timer, now = Date.now()) {
  return Math.min(
    timer.totalMs,
    timer.elapsedMs +
      (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt)),
  );
}
export function settledTimer(timer: Timer, now = Date.now()): Timer {
  const duration = elapsed(timer, now) - timer.elapsedMs;
  return {
    ...timer,
    elapsedMs: timer.elapsedMs + duration,
    startedAt: null,
    status: "paused",
    segments:
      timer.phase === "focus" && timer.startedAt !== null && duration > 0
        ? [
            ...timer.segments,
            { start: timer.startedAt, end: timer.startedAt + duration },
          ]
        : timer.segments,
  };
}
export function dueReminders(s: State, now = Date.now()) {
  const due: { key: string; title: string; date: string; hours: number }[] = [];
  const all = records(s, "event");
  if (!all.length) return due;
  const dates = [
    ...all.map((e) => e.date),
    ...records(s, "instance").flatMap((e) =>
      e.override.date ? [e.override.date] : [],
    ),
  ];
  const from = dates.reduce((a, d) => (d < a ? d : a), all[0].date);
  const to = new Date(now + 2 * 86400000).toISOString().slice(0, 10);
  for (const o of occurrences(s, from, to)) {
    if (o.done) continue;
    const target = zonedTime(o.date, o.time ?? "23:59", s.settings.timezone);
    for (const hour of o.reminders) {
      const at = target - hour * 3600000;
      const key = `${o.id}:${target}:${hour}`;
      if (
        at <= now &&
        !records(s, "receipt").some((x) => x.key === key && x.acknowledged)
      )
        due.push({ key, title: o.title, date: o.date, hours: hour });
    }
  }
  return due;
}
