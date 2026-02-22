// T039: Sync status hook — exposes sync state reactively
import { useState, useEffect } from "react";
import { onSyncEvent, type SyncEvent } from "@/services/sync";

export type SyncState =
  | "synced"
  | "syncing"
  | "offline"
  | "error"
  | "initial-sync";

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: string | null;
  error: string | null;
  initialSyncProgress: number | null;
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    state: navigator.onLine ? "synced" : "offline",
    lastSyncAt: null,
    error: null,
    initialSyncProgress: null,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        state: prev.state === "offline" ? "synced" : prev.state,
      }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, state: "offline", error: null }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = onSyncEvent((event: SyncEvent) => {
      switch (event.type) {
        case "sync-start":
          setStatus((prev) => ({
            ...prev,
            state: "syncing",
            error: null,
          }));
          break;
        case "sync-complete":
          setStatus((prev) => ({
            ...prev,
            state: navigator.onLine ? "synced" : "offline",
            lastSyncAt: new Date().toISOString(),
            error: null,
            initialSyncProgress: null,
          }));
          break;
        case "sync-error":
          setStatus((prev) => ({
            ...prev,
            state: "error",
            error: event.detail?.error ?? "Unknown error",
          }));
          break;
        case "initial-sync-progress":
          setStatus((prev) => ({
            ...prev,
            state: "initial-sync",
            initialSyncProgress: event.detail?.progress ?? 0,
          }));
          break;
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  return status;
}
