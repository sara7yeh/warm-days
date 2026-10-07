import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createRepository } from "./storage";
import { LifeService } from "./service";
import { type State } from "./model";
import { localDate } from "./dates";
import { registerLocalTools } from "./webmcp";
export const service = new LifeService(createRepository());
type Context = {
  state: State;
  today: string;
  notify: (message: string) => void;
  run: (work: () => Promise<unknown>, message?: string) => Promise<boolean>;
};
const AppContext = createContext<Context | null>(null);
export function useLife() {
  return useContext(AppContext)!;
}
export function LifeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => registerLocalTools(service), []);
  const reload = () =>
    service.repository
      .load()
      .then((s) => {
        setState((old) => (!old || s.revision >= old.revision ? s : old));
        setError("");
      })
      .catch((e) => setError(String(e.message ?? e)));
  useEffect(() => {
    void reload();
    const unsubscribe = service.repository.subscribe(() => {
      void reload();
    });
    const focus = () => {
      setClock(Date.now());
      void reload();
    };
    window.addEventListener("focus", focus);
    const t = setInterval(() => setClock(Date.now()), 30000);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", focus);
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const run = async (work: () => Promise<unknown>, message?: string) => {
    try {
      await work();
      await reload();
      if (message) setToast(message);
      return true;
    } catch (e) {
      setToast(e instanceof Error ? e.message : "保存失败，请重试");
      return false;
    }
  };
  if (!state)
    return (
      <div className="boot">
        <h1>暖日</h1>
        <p>{error || "正在打开你的小日子…"}</p>
        {error && <button onClick={() => void reload()}>重试</button>}
      </div>
    );
  return (
    <AppContext.Provider
      value={{
        state,
        today: localDate(clock, state.settings.timezone),
        notify: setToast,
        run,
      }}
    >
      {children}
      {error && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
      {toast && (
        <div className="toast" role="status" onClick={() => setToast("")}>
          {toast}
        </div>
      )}
    </AppContext.Provider>
  );
}
