// T036: Sync scheduler — manages sync triggers
import * as syncEngine from "@/services/sync";

const PERIODIC_INTERVAL_MS = 60_000; // 60 seconds
const DEBOUNCE_DELAY_MS = 2_000; // 2 seconds after last mutation

let getTokenFn: (() => Promise<string>) | null = null;
let cryptoKeyRef: CryptoKey | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

async function triggerSync(): Promise<void> {
  if (!getTokenFn || !cryptoKeyRef || isSyncing || !navigator.onLine) return;

  isSyncing = true;
  try {
    await syncEngine.sync(getTokenFn, cryptoKeyRef);
  } catch {
    // Errors are emitted via syncEngine events
  } finally {
    isSyncing = false;
  }
}

function handleVisibilityChange(): void {
  if (!document.hidden) {
    void triggerSync();
  }
}

function handleOnline(): void {
  void triggerSync();
}

export function start(getToken: () => Promise<string>, key: CryptoKey): void {
  getTokenFn = getToken;
  cryptoKeyRef = key;

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);

  periodicTimer = setInterval(() => {
    if (!document.hidden) {
      void triggerSync();
    }
  }, PERIODIC_INTERVAL_MS);

  // Initial sync on start
  void triggerSync();
}

export function stop(): void {
  getTokenFn = null;
  cryptoKeyRef = null;

  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("online", handleOnline);

  if (periodicTimer !== null) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

export function requestSync(): void {
  // Debounced: wait for mutations to settle before syncing
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void triggerSync();
  }, DEBOUNCE_DELAY_MS);
}
