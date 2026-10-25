import { STORAGE_KEYS } from "@/lib/config";

export type ApiKeyState = {
  key: string;
  persist: boolean;
  source: "local" | "session" | "none";
};

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore storage errors (private mode, quota).
  }
}

function safeRemove(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function readApiKey(): ApiKeyState {
  if (typeof window === "undefined") {
    return { key: "", persist: true, source: "none" };
  }

  const local = safeGet(window.localStorage, STORAGE_KEYS.apiKey);
  if (local) return { key: local, persist: true, source: "local" };

  const session = safeGet(window.sessionStorage, STORAGE_KEYS.sessionApiKey);
  if (session) return { key: session, persist: false, source: "session" };

  return { key: "", persist: true, source: "none" };
}

export function writeApiKey(key: string, persist: boolean): ApiKeyState {
  if (typeof window === "undefined") {
    return { key, persist, source: "none" };
  }

  safeRemove(window.localStorage, STORAGE_KEYS.apiKey);
  safeRemove(window.sessionStorage, STORAGE_KEYS.sessionApiKey);

  if (key) {
    if (persist) safeSet(window.localStorage, STORAGE_KEYS.apiKey, key);
    else safeSet(window.sessionStorage, STORAGE_KEYS.sessionApiKey, key);
  }

  return {
    key,
    persist,
    source: key ? (persist ? "local" : "session") : "none",
  };
}

export function clearApiKey(): void {
  if (typeof window === "undefined") return;
  safeRemove(window.localStorage, STORAGE_KEYS.apiKey);
  safeRemove(window.sessionStorage, STORAGE_KEYS.sessionApiKey);
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 5)}••••••••${key.slice(-4)}`;
}
