const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let timerId: ReturnType<typeof setTimeout> | null = null;
let onLockCallback: (() => void) | null = null;
let timeoutMs = DEFAULT_TIMEOUT_MS;

function handleVisibilityChange(): void {
  if (document.hidden && onLockCallback) {
    onLockCallback();
  }
}

function startTimer(): void {
  stopTimer();
  timerId = setTimeout(() => {
    if (onLockCallback) {
      onLockCallback();
    }
  }, timeoutMs);
}

function stopTimer(): void {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

export function start(onLock: () => void, timeout?: number): void {
  onLockCallback = onLock;
  if (timeout !== undefined) {
    timeoutMs = timeout;
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  startTimer();
}

export function resetTimer(): void {
  if (onLockCallback) {
    startTimer();
  }
}

export function stop(): void {
  stopTimer();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  onLockCallback = null;
  timeoutMs = DEFAULT_TIMEOUT_MS;
}
