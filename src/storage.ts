import { defaultState, validateState, type State } from "./model";
export const appNamespace = `warm-days:${typeof location === "undefined" ? "/" : new URL(import.meta.env.BASE_URL, location.href).pathname}:v1${import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("qa") ? ":qa" : ""}`;
export interface DataRepository {
  load(): Promise<State>;
  commit(expectedRevision: number, next: State): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}
// Increment IndexedDB's version only for object-store changes. Payload migrations live here.
export function migrate(raw: unknown): State {
  if (!raw) return defaultState();
  return validateState(raw);
}
export class IndexedDbRepository implements DataRepository {
  private db: Promise<IDBDatabase>;
  private channel: BroadcastChannel | undefined;
  private listeners = new Set<() => void>();
  constructor(name = appNamespace) {
    this.db = new Promise((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("state"))
          r.result.createObjectStore("state");
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("请关闭此网站的其他旧标签页后重试"));
    });
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(name);
      this.channel.onmessage = () => this.notify(false);
    }
  }
  private notify(broadcast = true) {
    this.listeners.forEach((f) => f());
    if (broadcast) this.channel?.postMessage("changed");
  }
  subscribe(f: () => void) {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  }
  async load() {
    const db = await this.db;
    return new Promise<State>((resolve, reject) => {
      const r = db.transaction("state").objectStore("state").get("main");
      r.onsuccess = () => {
        try {
          resolve(migrate(r.result));
        } catch (e) {
          reject(e);
        }
      };
      r.onerror = () => reject(r.error);
    });
  }
  async commit(expectedRevision: number, next: State) {
    const validated = validateState(next);
    const db = await this.db;
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      const store = tx.objectStore("state");
      const req = store.get("main");
      let success = false;
      req.onsuccess = () => {
        const revision = req.result?.revision ?? 0;
        if (revision === expectedRevision) {
          store.put({ ...validated, revision: expectedRevision + 1 }, "main");
          success = true;
        }
      };
      tx.oncomplete = () => {
        if (success) this.notify();
        resolve(success);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("保存失败"));
    });
  }
}
export const storageConfig = { mode: "local" as const };
export function createRepository(): DataRepository {
  return new IndexedDbRepository(appNamespace);
}
