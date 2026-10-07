import { useEffect, useState } from "react";
import {
  Sun,
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  Gamepad2,
  NotebookPen,
  Settings,
  ChevronRight,
  ArrowUpRight,
  Flower2,
  Clock3,
  Heart,
  Flame,
  BookOpen,
  StickyNote,
  Bell,
  Plus,
} from "lucide-react";
import { useLife, service } from "./context";
import { records } from "./model";
import { occurrences, dueReminders } from "./domain";
import { formatDate, weekday } from "./dates";
import { Section, Empty, PageHead, Modal, CheckButton } from "./ui";
import {
  CalendarPage,
  TasksPage,
  HealthPage,
  HabitsPage,
  StudyPage,
  JournalPage,
  MemosPage,
  AnniversariesPage,
  SettingsPage,
  TimerWatcher,
} from "./pages";
const nav = [
  ["today", "今天", LayoutDashboard],
  ["calendar", "日程", CalendarDays],
  ["tasks", "待办", ListTodo],
  ["games", "游戏", Gamepad2],
  ["records", "记录", NotebookPen],
  ["settings", "我的", Settings],
] as const;
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(2) || "today");
  useEffect(() => {
    const cb = () => setRoute(location.hash.slice(2) || "today");
    window.addEventListener("hashchange", cb);
    return () => window.removeEventListener("hashchange", cb);
  }, []);
  return route;
}
export default function App() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  const { state, today, run } = useLife();
  const [quick, setQuick] = useState(false);
  const due = dueReminders(state);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#/today">
          <span className="brand-icon">
            <Sun size={25} />
          </span>
          <span>
            暖日<small>WARM DAYS</small>
          </span>
        </a>
        <p className="nav-caption">我的生活手账</p>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <a
              href={`#/${id}`}
              className={
                route === id ||
                (id === "records" &&
                  ["health", "habits", "study", "journal", "memos"].includes(
                    route,
                  )) ||
                (id === "settings" && route === "anniversaries")
                  ? "active"
                  : ""
              }
              key={id}
            >
              <Icon size={21} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <Flower2 size={28} />
          <p>
            慢慢来，
            <br />
            日子会有自己的答案。
          </p>
          <span>只属于你的生活空间</span>
        </div>
        <div className="local-label">
          <span /> 本机保存 · 无需登录
        </div>
      </aside>
      <main>
        <TimerWatcher />
        <div className="topbar">
          <span>{formatDate(today)}</span>
          <span className="topbar-right">
            <span className="desktop-only">留一点时间给自己</span>
            <button
              className="avatar"
              onClick={() => (location.hash = "/settings")}
              aria-label="我的设置"
            >
              暖
            </button>
          </span>
        </div>
        {due.length > 0 && (
          <div className="reminder-banner">
            <Bell size={19} />
            <div>
              <strong>有 {due.length} 条提醒等你查看</strong>
              <p>
                {due
                  .slice(0, 3)
                  .map((d) => `${d.title}（${d.date}，提前${d.hours}小时）`)
                  .join(" · ")}
                {due.length > 3 ? "…" : ""}
              </p>
            </div>
            <button
              onClick={() =>
                void run(() => service.acknowledge(due.map((d) => d.key)))
              }
            >
              知道了
            </button>
          </div>
        )}
        {route === "today" ? (
          <Today onQuick={() => setQuick(true)} />
        ) : route === "games" ? (
          <Games />
        ) : route === "records" ? (
          <Records />
        ) : route === "calendar" ? (
          <CalendarPage />
        ) : route === "tasks" ? (
          <TasksPage />
        ) : route === "health" ? (
          <HealthPage />
        ) : route === "habits" ? (
          <HabitsPage />
        ) : route === "study" ? (
          <StudyPage />
        ) : route === "journal" ? (
          <JournalPage />
        ) : route === "memos" ? (
          <MemosPage />
        ) : route === "anniversaries" ? (
          <AnniversariesPage />
        ) : route === "settings" ? (
          <SettingsPage />
        ) : (
          <Today onQuick={() => setQuick(true)} />
        )}
        <footer className="page-footer">
          <Flower2 size={14} /> 每一个平凡的日子，都值得被好好收藏。
        </footer>
      </main>
      {quick && (
        <Modal title="今天想记点什么？" onClose={() => setQuick(false)}>
          <div className="quick-grid">
            {[
              ["calendar", "一段日程"],
              ["tasks", "一件待办"],
              ["journal", "一篇日记"],
              ["health", "身体记录"],
            ].map(([id, label]) => (
              <a
                className="quick-item"
                href={`#/${id}`}
                key={id}
                onClick={() => setQuick(false)}
              >
                <Plus size={20} />
                {label}
                <ChevronRight size={16} />
              </a>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function Today({ onQuick }: { onQuick: () => void }) {
  const { state, today, run } = useLife();
  const items = occurrences(state, today, today);
  const tasks = records(state, "task").filter(
    (t) => !t.done && (!t.date || t.date <= today),
  );
  return (
    <>
      <PageHead
        eyebrow="A LITTLE MORE PRESENT"
        title="今天，也要好好生活"
        description="把重要的事记下来，把剩下的时间留给喜欢。"
        action={
          <button className="primary" onClick={onQuick}>
            <Plus size={18} />
            记一笔
          </button>
        }
      />
      <div className="welcome-card">
        <div className="welcome-copy">
          <span className="pill light">
            <Sun size={14} /> 今日小笺
          </span>
          <h2>
            不用赶路，
            <br />
            按照自己的节奏就好。
          </h2>
          <p>一件件完成，一点点靠近喜欢的自己。</p>
          <a href="#/study" className="welcome-link">
            开始一段专注 <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="welcome-date">
          <span>
            {new Date(today + "T12:00:00")
              .toLocaleDateString("en", { month: "long" })
              .toUpperCase()}
          </span>
          <strong>{today.slice(-2)}</strong>
          <span>{formatDate(today).split("日")[1]}</span>
          <div className="date-rule" />
          <small>好日子，正在发生</small>
        </div>
      </div>
      <div className="stat-grid">
        {[
          ["今天的日程", items.length, "件事，慢慢来", CalendarDays],
          [
            "待完成事项",
            tasks.length + items.filter((i) => !i.done).length,
            "给努力一点回响",
            ListTodo,
          ],
          [
            "我的小习惯",
            records(state, "habit").length,
            "坚持，从今天开始",
            Flame,
          ],
          ["今日心情", "写下来", "为自己留一页空白", Heart],
        ].map(([label, value, sub, Icon], i) => {
          const I = Icon as typeof Heart;
          return (
            <a
              className={`stat stat-${i}`}
              href={["#/calendar", "#/tasks", "#/habits", "#/journal"][i]}
              key={String(label)}
            >
              <div>
                <span>{String(label)}</span>
                <I size={19} />
              </div>
              <strong>{String(value)}</strong>
              <small>{String(sub)}</small>
            </a>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <Section
          title="今天的安排"
          aside={
            <a className="text-link" href="#/calendar">
              查看日历 <ChevronRight size={15} />
            </a>
          }
        >
          {items.length ? (
            items.slice(0, 5).map((i) => (
              <a href="#/calendar" className="timeline-row" key={i.id}>
                <span>{i.time ?? "全天"}</span>
                <div>
                  <strong>{i.title}</strong>
                  <small>{i.category}</small>
                </div>
                <span className="pill">{i.done ? "已完成" : "待进行"}</span>
              </a>
            ))
          ) : (
            <Empty
              text="今天还没有安排，给日子留一点期待"
              action="添加日程"
              onAdd={() => (location.hash = "/calendar")}
            />
          )}
        </Section>
        <Section title="给自己一点时间" className="self-card">
          <a href="#/study" className="focus-entry">
            <span className="round-icon">
              <Clock3 />
            </span>
            <div>
              <strong>进入专注时光</strong>
              <p>{state.settings.focusMinutes} 分钟，只做一件事</p>
            </div>
            <ChevronRight size={20} />
          </a>
          <a href="#/journal" className="journal-entry">
            <NotebookPen size={22} />
            <div>
              <strong>今天有什么想留下？</strong>
              <p>开心的小事，或是没说出口的话。</p>
            </div>
            <ChevronRight size={18} />
          </a>
          <a className="text-link" href="#/habits">
            看看今天的小习惯 <ChevronRight size={15} />
          </a>
        </Section>
      </div>
      <div className="dashboard-grid completed">
        <Section
          title="待办小清单"
          aside={
            <a className="text-link" href="#/tasks">
              全部待办 <ChevronRight size={15} />
            </a>
          }
        >
          {tasks.slice(0, 5).map((t) => (
            <div className="entry-row" key={t.id}>
              <CheckButton
                checked={t.done}
                label={`完成${t.title}`}
                onClick={() =>
                  void run(() =>
                    service.save({ ...t, done: true }, t.updatedAt),
                  )
                }
              />
              <div className="entry-body">
                <strong>{t.title}</strong>
                <small>
                  {t.category} · {t.date ?? "不限日期"}
                </small>
              </div>
            </div>
          ))}
          {!tasks.length && <Empty text="没有待完成的小事，享受这份轻松" />}
        </Section>
        <Section
          title="今天的小习惯"
          aside={
            <a className="text-link" href="#/habits">
              打卡记录 <ChevronRight size={15} />
            </a>
          }
        >
          {records(state, "habit")
            .filter(
              (h) =>
                h.startDate <= today && h.weekdays.includes(weekday(today)),
            )
            .map((h) => {
              const value =
                records(state, "checkin").find(
                  (c) => c.habitId === h.id && c.date === today,
                )?.value ?? 0;
              return (
                <div className="entry-row" key={h.id}>
                  <CheckButton
                    checked={value >= h.target}
                    label={`打卡${h.title}`}
                    onClick={() =>
                      void run(() =>
                        service.checkin(
                          h.id,
                          today,
                          value >= h.target ? 0 : h.target,
                        ),
                      )
                    }
                  />
                  <div className="entry-body">
                    <strong>{h.title}</strong>
                    <small>
                      {h.mode === "quantity"
                        ? `${value} / ${h.target} ${h.unit}`
                        : value >= h.target
                          ? "已完成"
                          : "小小坚持，也很了不起"}
                    </small>
                  </div>
                  {h.mode === "quantity" && (
                    <a href="#/habits" className="text-link">
                      记数量
                    </a>
                  )}
                </div>
              );
            })}
          {!records(state, "habit").some(
            (h) => h.startDate <= today && h.weekdays.includes(weekday(today)),
          ) && (
            <Empty
              text="种下一个小习惯，等它慢慢发芽"
              onAdd={() => (location.hash = "/habits")}
            />
          )}
        </Section>
      </div>
    </>
  );
}
function Games() {
  return (
    <>
      <PageHead
        eyebrow="PLAY, REST, REPEAT"
        title="快乐补给站"
        description="认真生活，也要尽兴地玩。"
      />
      <div className="game-intro">
        <Gamepad2 size={36} />
        <div>
          <h2>给快乐留个位置</h2>
          <p>你的游戏手账，下一次更新见。</p>
        </div>
        <span className="pill">筹备中</span>
      </div>
      <div className="game-grid">
        {[
          ["01", "VALORANT", "瓦罗兰特", "记录每一次并肩作战。"],
          [
            "02",
            "DELTA FORCE",
            "三角洲行动",
            "改枪灵感、地图笔记，都留在这里。",
          ],
          ["03", "STEAM LIBRARY", "Steam", "收藏那些值得投入时间的世界。"],
        ].map(([n, en, cn, text]) => (
          <article className={`game-card game-${n}`} key={n}>
            <div className="game-top">
              <span>{n}</span>
              <Gamepad2 size={35} />
            </div>
            <p>{en}</p>
            <h2>{cn}</h2>
            <span>{text}</span>
            <div className="game-bottom">
              专属记录空间 <span>即将开放</span>
            </div>
          </article>
        ))}
      </div>
      <p className="muted">
        第一版仅预留入口，游戏时长、收益与攻略记录后续加入。
      </p>
    </>
  );
}
function Records() {
  return (
    <>
      <PageHead
        eyebrow="SMALL MOMENTS, BIG MEANING"
        title="生活的温柔切片"
        description="照顾身体，安放心事，也看见自己的成长。"
      />
      <div className="record-grid">
        {[
          ["health", "身体与运动", "体重、围度、运动和好好吃饭", Heart],
          ["habits", "习惯打卡", "把想做的事，慢慢变成日常", Flame],
          ["study", "学习时光", "一段专注，一点积累", BookOpen],
          ["journal", "一日一记", "这一页，只听你说", NotebookPen],
          ["memos", "随手备忘", "留住一闪而过的念头", StickyNote],
        ].map(([id, title, desc, Icon]) => {
          const I = Icon as typeof Heart;
          return (
            <a className="record-card" href={`#/${id}`} key={String(id)}>
              <span className="round-icon">
                <I />
              </span>
              <h2>{String(title)}</h2>
              <p>{String(desc)}</p>
              <ChevronRight size={20} />
            </a>
          );
        })}
      </div>
    </>
  );
}
