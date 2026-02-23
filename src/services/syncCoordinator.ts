// T037: Cross-tab sync coordinator using Web Locks for leader election
// and BroadcastChannel for inter-tab communication.

const LOCK_NAME = "reflog-sync-leader";
const CHANNEL_NAME = "reflog-sync";

type CoordinatorMessage =
  | { type: "sync-complete"; changedIds: string[] }
  | { type: "sync-requested" };

let channel: BroadcastChannel | null = null;
let isLeader = false;
let lockController: AbortController | null = null;
let onSyncRequested: (() => void) | null = null;
let onRemoteSyncComplete: ((changedIds: string[]) => void) | null = null;

function handleMessage(event: MessageEvent<CoordinatorMessage>): void {
  const data = event.data;

  if (data.type === "sync-requested" && isLeader && onSyncRequested) {
    onSyncRequested();
  }

  if (data.type === "sync-complete" && !isLeader && onRemoteSyncComplete) {
    onRemoteSyncComplete(data.changedIds);
  }
}

export function broadcastSyncComplete(changedIds: string[]): void {
  channel?.postMessage({
    type: "sync-complete",
    changedIds,
  } satisfies CoordinatorMessage);
}

export function requestRemoteSync(): void {
  if (!isLeader) {
    channel?.postMessage({
      type: "sync-requested",
    } satisfies CoordinatorMessage);
  }
}

export function start(options: {
  onBecomeLeader: () => void;
  onSyncRequested: () => void;
  onRemoteSyncComplete: (changedIds: string[]) => void;
}): void {
  onSyncRequested = options.onSyncRequested;
  onRemoteSyncComplete = options.onRemoteSyncComplete;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", handleMessage);

  // Attempt to acquire leader lock
  if ("locks" in navigator) {
    lockController = new AbortController();
    try {
      void navigator.locks.request(
        LOCK_NAME,
        { signal: lockController.signal },
        async () => {
          isLeader = true;
          options.onBecomeLeader();

          // Hold the lock until the tab closes or stop() is called
          return new Promise<void>((resolve) => {
            lockController?.signal.addEventListener("abort", () => {
              resolve();
            });
          });
        },
      );
    } catch {
      // Lock request failed — another tab is leader
    }
  } else {
    // Fallback: assume leader (single-tab behavior)
    isLeader = true;
    options.onBecomeLeader();
  }
}

export function stop(): void {
  if (lockController) {
    lockController.abort();
    lockController = null;
  }

  if (channel) {
    channel.removeEventListener("message", handleMessage);
    channel.close();
    channel = null;
  }

  isLeader = false;
  onSyncRequested = null;
  onRemoteSyncComplete = null;
}

export function getIsLeader(): boolean {
  return isLeader;
}
