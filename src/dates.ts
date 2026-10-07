export function localDate(
  timestamp = Date.now(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}
export function addDays(date: string, amount: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}
export function weekday(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}
export function zonedTime(date: string, time: string, zone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const desired = Date.UTC(y, m - 1, d, h, min);
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const actual = Date.UTC(
      n("year"),
      n("month") - 1,
      n("day"),
      n("hour"),
      n("minute"),
      n("second"),
    );
    const delta = desired - actual;
    if (delta === 0) return guess;
    guess += delta;
  }
  return guess;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export function splitSegments(
  segments: { start: number; end: number }[],
  timezone: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const seg of segments) {
    let cursor = seg.start;
    while (cursor < seg.end) {
      const date = localDate(cursor, timezone);
      const midnight = zonedTime(addDays(date, 1), "00:00", timezone);
      const end = Math.min(
        seg.end,
        midnight > cursor ? midnight : cursor + 3600000,
      );
      totals[date] = (totals[date] ?? 0) + (end - cursor) / 60000;
      cursor = end;
    }
  }
  return totals;
}
