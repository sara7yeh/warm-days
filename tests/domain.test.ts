import { describe, it, expect, vi, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  defaultState,
  meta,
  records,
  validateState,
  type State,
  type Event,
} from "../src/model";
import { LifeService } from "../src/service";
import { IndexedDbRepository, type DataRepository } from "../src/storage";
import {
  occurrences,
  dueReminders,
  elapsed,
  settledTimer,
} from "../src/domain";
import { splitSegments, zonedTime, dayDiff } from "../src/dates";
class Memory implements DataRepository {
  state = defaultState();
  async load() {
    return structuredClone(this.state);
  }
  async commit(rev: number, next: State) {
    if (rev !== this.state.revision) return false;
    this.state = { ...structuredClone(validateState(next)), revision: rev + 1 };
    return true;
  }
  subscribe() {
    return () => {};
  }
}
function fixture() {
  const repo = new Memory();
  repo.state.settings.timezone = "Asia/Shanghai";
  const event: Event = {
    ...meta(),
    kind: "event",
    title: "数学",
    date: "2026-10-06",
    time: "09:00",
    endTime: "10:00",
    category: "课程",
    notes: "教室A",
    reminders: [1, 3],
    repeat: true,
    until: "2026-11-03",
  };
  repo.state.entries.push(event);
  return { repo, event, svc: new LifeService(repo) };
}
afterEach(() => vi.useRealTimers());
describe("日程与待办同源", () => {
  it("每周实例独立完成，日历保留历史", async () => {
    const { svc, repo, event } = fixture();
    await svc.setOccurrence(event.id, "2026-10-13", { done: true });
    const all = occurrences(repo.state, "2026-10-01", "2026-11-30");
    expect(all).toHaveLength(5);
    expect(all.filter((i) => i.done).map((i) => i.date)).toEqual([
      "2026-10-13",
    ]);
  });
  it("单次调课跨月，不影响其他课；清除时间可备份还原", async () => {
    const { svc, repo, event } = fixture();
    await svc.editOccurrence(
      event.id,
      "2026-10-13",
      {
        ...event,
        date: "2026-11-05",
        title: "调课",
        time: undefined,
        endTime: undefined,
      },
      "one",
    );
    const restored = svc.parseBackup(await svc.export());
    expect(occurrences(restored, "2026-10-13", "2026-10-13")).toHaveLength(0);
    const moved = occurrences(restored, "2026-11-05", "2026-11-05");
    expect(moved[0].title).toBe("调课");
    expect(moved[0].time).toBeUndefined();
    expect(occurrences(restored, "2026-10-20", "2026-10-20")[0].title).toBe(
      "数学",
    );
  });
  it("本次及以后分段，过去的完成历史仍然存在", async () => {
    const { svc, repo, event } = fixture();
    await svc.setOccurrence(event.id, "2026-10-06", { done: true });
    await svc.editOccurrence(
      event.id,
      "2026-10-20",
      { ...event, date: "2026-10-21", title: "新课程" },
      "future",
    );
    const all = occurrences(repo.state, "2026-10-01", "2026-11-30");
    expect(all[0].done).toBe(true);
    expect(all.find((i) => i.date === "2026-10-13")?.title).toBe("数学");
    expect(all.find((i) => i.date === "2026-10-20")).toBeUndefined();
    expect(all.find((i) => i.date === "2026-10-21")?.title).toBe("新课程");
  });
  it("取消本次不删除系列", async () => {
    const { svc, repo, event } = fixture();
    await svc.setOccurrence(event.id, "2026-10-13", { cancelled: true });
    expect(occurrences(repo.state, "2026-10-01", "2026-11-30")).toHaveLength(4);
    expect(records(repo.state, "event")).toHaveLength(1);
  });
});
describe("提醒", () => {
  it("日期事项以23:59为基准，多个提醒依次到达，确认后去重", async () => {
    const { svc, repo, event } = fixture();
    await svc.save({
      ...event,
      repeat: false,
      until: undefined,
      time: undefined,
      endTime: undefined,
      reminders: [1, 3, 5, 7],
    });
    expect(
      dueReminders(repo.state, zonedTime(event.date, "16:58", "Asia/Shanghai")),
    ).toHaveLength(0);
    const due = dueReminders(
      repo.state,
      zonedTime(event.date, "20:59", "Asia/Shanghai"),
    );
    expect(due).toHaveLength(3);
    await svc.acknowledge(due.map((d) => d.key));
    expect(
      dueReminders(repo.state, zonedTime(event.date, "20:59", "Asia/Shanghai")),
    ).toHaveLength(0);
    expect(
      dueReminders(repo.state, zonedTime(event.date, "22:59", "Asia/Shanghai")),
    ).toHaveLength(1);
  });
  it("跨日提前提醒，完成后取消所有未确认提醒", async () => {
    const { svc, repo, event } = fixture();
    await svc.save({
      ...event,
      time: "02:00",
      endTime: undefined,
      repeat: false,
      until: undefined,
      reminders: [7],
    });
    expect(
      dueReminders(
        repo.state,
        zonedTime("2026-10-05", "19:00", "Asia/Shanghai"),
      ),
    ).toHaveLength(1);
    await svc.setOccurrence(event.id, event.date, { done: true });
    expect(
      dueReminders(
        repo.state,
        zonedTime("2026-10-05", "19:00", "Asia/Shanghai"),
      ),
    ).toHaveLength(0);
  });
});
describe("计时与时区", () => {
  it("暂停不计时，刷新恢复，多个标签页结束只写一次", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    const { svc, repo } = fixture();
    await svc.startTimer("focus");
    const id = repo.state.timer!.id;
    vi.advanceTimersByTime(60000);
    await svc.timerAction("pause", id);
    vi.advanceTimersByTime(600000);
    expect(elapsed(repo.state.timer!)).toBe(60000);
    await svc.timerAction("resume", id);
    vi.advanceTimersByTime(30000);
    await Promise.all([
      svc.timerAction("finish", id),
      svc.timerAction("finish", id),
    ]);
    const sessions = records(repo.state, "session");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].segments.reduce((n, s) => n + s.end - s.start, 0)).toBe(
      90000,
    );
    expect(repo.state.timer).toBeNull();
  });
  it("超时后只计入目标时长，不把关闭后的所有时间计入", async () => {
    vi.useFakeTimers();
    const { svc, repo } = fixture();
    await svc.startTimer("focus");
    const id = repo.state.timer!.id;
    vi.advanceTimersByTime(24 * 3600000);
    await svc.timerAction("finish", id);
    expect(
      records(repo.state, "session")[0].segments.reduce(
        (n, s) => n + s.end - s.start,
        0,
      ),
    ).toBe(25 * 60000);
    expect(repo.state.rounds).toBe(1);
  });
  it("跨午夜分摊且支持夏令时日期", () => {
    const start = zonedTime("2026-10-06", "23:50", "Asia/Shanghai");
    const end = zonedTime("2026-10-07", "00:15", "Asia/Shanghai");
    expect(splitSegments([{ start, end }], "Asia/Shanghai")).toEqual({
      "2026-10-06": 10,
      "2026-10-07": 15,
    });
    const a = zonedTime("2026-03-08", "00:00", "America/Los_Angeles"),
      b = zonedTime("2026-03-09", "00:00", "America/Los_Angeles");
    expect((b - a) / 3600000).toBe(23);
    expect(dayDiff("2026-03-09", "2026-03-08")).toBe(1);
  });
});
describe("备份与本地持久化", () => {
  it("无效关联、重复ID与未来版本拒绝，不破坏原数据", async () => {
    const { svc, repo, event } = fixture();
    const original = await svc.export();
    const broken = structuredClone(repo.state);
    broken.entries.push({
      ...meta(),
      kind: "instance",
      eventId: crypto.randomUUID(),
      occurrenceDate: event.date,
      done: false,
      cancelled: false,
      override: {},
    });
    await expect(svc.import(broken)).rejects.toThrow("关联");
    expect(JSON.parse(await svc.export()).data).toEqual(
      JSON.parse(original).data,
    );
    expect(() => validateState({ ...repo.state, schemaVersion: 2 })).toThrow();
    expect(() =>
      validateState({ ...repo.state, entries: [event, event] }),
    ).toThrow("重复");
  });
  it("备份完整还原稀疏健康数据与日记", async () => {
    const { svc, repo } = fixture();
    await svc.save({
      ...meta(),
      kind: "health",
      date: "2026-10-06",
      exercised: false,
      exercise: "",
      food: "",
      measures: { 腰围: 70 },
    });
    await svc.save({
      ...meta(),
      kind: "journal",
      date: "2026-10-06",
      body: "测试记录",
    });
    const backup = svc.parseBackup(await svc.export());
    await svc.import(backup);
    expect(records(repo.state, "health")[0].weight).toBeUndefined();
    expect(records(repo.state, "journal")[0].body).toBe("测试记录");
  });
  it("两类打卡可更新同一天，删除习惯清理关联", async () => {
    const { svc, repo } = fixture();
    const id = crypto.randomUUID();
    await svc.save({
      ...meta(id),
      kind: "habit",
      title: "喝水",
      mode: "quantity",
      target: 8,
      unit: "杯",
      weekdays: [1, 2, 3, 4, 5],
      startDate: "2026-10-01",
    });
    await svc.checkin(id, "2026-10-06", 2);
    await svc.checkin(id, "2026-10-06", 8);
    expect(records(repo.state, "checkin")).toHaveLength(1);
    expect(records(repo.state, "checkin")[0].value).toBe(8);
    await svc.remove(id);
    expect(records(repo.state, "checkin")).toHaveLength(0);
  });
  it("日记冲突不会覆盖另一标签页的新内容", async () => {
    const { svc, repo } = fixture();
    const j = {
      ...meta(),
      kind: "journal" as const,
      date: "2026-10-06",
      body: "原文",
    };
    await svc.save(j);
    const stored = records(repo.state, "journal")[0];
    await svc.save({ ...stored, body: "更新" });
    await expect(
      svc.save({ ...stored, body: "过期编辑" }, "2020-01-01T00:00:00.000Z"),
    ).rejects.toThrow("另一标签页");
    expect(records(repo.state, "journal")[0].body).toBe("更新");
  });
  it("IndexedDB事务比较版本，刷新和版本1重新打开保留数据", async () => {
    const name = "test-" + crypto.randomUUID();
    const a = new IndexedDbRepository(name);
    const s = await a.load();
    s.entries.push({ ...meta(), kind: "memo", title: "保留", body: "正文" });
    expect(await a.commit(0, s)).toBe(true);
    expect(await a.commit(0, { ...s, entries: [] })).toBe(false);
    const b = new IndexedDbRepository(name);
    expect(records(await b.load(), "memo")[0].title).toBe("保留");
  });
});

it("调课提前至系列开始前，仍可提醒", async () => {
  const { svc, repo, event } = fixture();
  await svc.editOccurrence(
    event.id,
    event.date,
    { ...event, date: "2026-10-01", time: "09:00", reminders: [1] },
    "one",
  );
  expect(
    dueReminders(repo.state, zonedTime("2026-10-01", "08:00", "Asia/Shanghai")),
  ).toHaveLength(1);
});
