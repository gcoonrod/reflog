// T035: Sync engine — push-then-pull delta sync with E2E encryption
import db from "@/db";
import { setSyncing } from "@/db/middleware";
import * as syncApi from "@/services/syncApi";
import { encryptForSync, decryptFromSync } from "@/services/syncCrypto";
import type { Entry, SyncRecord } from "@/types";
import type { SyncQueueEntry } from "@/db/schema";

const TABLE_TO_RECORD_TYPE: Record<string, SyncRecord["recordType"]> = {
  entries: "entry",
  settings: "setting",
  vault_meta: "vault_meta",
};

const RECORD_TYPE_TO_TABLE: Record<SyncRecord["recordType"], string> = {
  entry: "entries",
  setting: "settings",
  vault_meta: "vault_meta",
};

async function applyChange(
  recordType: SyncRecord["recordType"],
  id: string,
  decryptedData: unknown,
  isTombstone: boolean,
): Promise<void> {
  const tableName = RECORD_TYPE_TO_TABLE[recordType];
  if (isTombstone) {
    await db.table(tableName).delete(id);
  } else {
    await db.table(tableName).put(decryptedData);
  }
}

export type SyncEventType =
  | "sync-start"
  | "sync-complete"
  | "sync-error"
  | "conflict-resolved"
  | "initial-sync-progress";

export interface SyncEvent {
  type: SyncEventType;
  detail?: {
    changedIds?: string[];
    error?: string;
    progress?: number;
    conflictTitle?: string;
    conflictType?: "updated" | "deleted";
  };
}

type SyncListener = (event: SyncEvent) => void;

const listeners = new Set<SyncListener>();

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: SyncEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

async function getDeviceId(): Promise<string | null> {
  const meta = await db.sync_meta.get("deviceId");
  return meta?.value ?? null;
}

async function getLastPullTimestamp(): Promise<string> {
  const meta = await db.sync_meta.get("lastPullTimestamp");
  return meta?.value ?? "1970-01-01T00:00:00Z";
}

async function setLastPullTimestamp(timestamp: string): Promise<void> {
  await db.sync_meta.put({ key: "lastPullTimestamp", value: timestamp });
}

export async function push(
  getToken: () => Promise<string>,
  cryptoKey: CryptoKey,
): Promise<void> {
  const deviceId = await getDeviceId();
  if (!deviceId) return;

  // Read all pending changes
  const queue = await db.sync_queue.orderBy("timestamp").toArray();
  if (queue.length === 0) return;

  // Deduplicate: keep only the latest entry per [tableName+recordId]
  const deduped = new Map<string, SyncQueueEntry>();
  for (const entry of queue) {
    const key = `${entry.tableName}|${entry.recordId}`;
    deduped.set(key, entry);
  }

  const lastPullTimestamp = await getLastPullTimestamp();
  const token = await getToken();

  // Build push request
  const changes = await Promise.all(
    Array.from(deduped.values()).map(async (entry) => {
      let encryptedPayload = "";
      const isTombstone = entry.operation === "delete";

      if (!isTombstone && entry.payload) {
        const record = JSON.parse(entry.payload) as object;
        encryptedPayload = await encryptForSync(record, cryptoKey);
      }

      return {
        id: entry.recordId,
        recordType:
          TABLE_TO_RECORD_TYPE[entry.tableName] ??
          ("entry" as SyncRecord["recordType"]),
        encryptedPayload,
        isTombstone,
        deviceId,
      };
    }),
  );

  // Push in batches of 100, track conflicted record IDs
  const conflictedRecordIds = new Set<string>();
  for (let i = 0; i < changes.length; i += 100) {
    const batch = changes.slice(i, i + 100);
    const response = await syncApi.push(token, {
      changes: batch,
      deviceId,
      lastPullTimestamp,
    });
    for (const conflict of response.conflicts) {
      conflictedRecordIds.add(conflict.id);
    }
  }

  // Only delete queue entries for accepted records (not conflicted ones)
  const acceptedQueueIds = queue
    .filter((e) => !conflictedRecordIds.has(e.recordId))
    .map((e) => e.id)
    .filter((id): id is number => id !== undefined);
  if (acceptedQueueIds.length > 0) {
    await db.sync_queue.bulkDelete(acceptedQueueIds);
  }
}

export async function pull(
  getToken: () => Promise<string>,
  cryptoKey: CryptoKey,
): Promise<string[]> {
  const lastPullTimestamp = await getLastPullTimestamp();
  const token = await getToken();
  const changedIds: string[] = [];

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await syncApi.pull(token, lastPullTimestamp, cursor, 100);

    setSyncing(true);
    try {
      for (const change of response.changes) {
        const tableName = RECORD_TYPE_TO_TABLE[change.recordType];

        if (change.isTombstone) {
          // Check for edit-wins-over-delete using the correct table name
          const hasUnsynced = await db.sync_queue
            .where("[tableName+recordId]")
            .equals([tableName, change.id])
            .count();

          if (hasUnsynced > 0) {
            // Edit wins over delete — skip tombstone
            emit({
              type: "conflict-resolved",
              detail: {
                conflictTitle: change.id,
                conflictType: "deleted",
              },
            });
            continue;
          }

          await applyChange(change.recordType, change.id, null, true);
          changedIds.push(change.id);
          continue;
        }

        // Decrypt the record
        const decrypted = await decryptFromSync(
          change.encryptedPayload,
          cryptoKey,
        );

        // LWW: check if local version is newer (only for entries with updatedAt)
        if (change.recordType === "entry") {
          const local = await db.entries.get(change.id);
          if (local && change.updatedAt && local.updatedAt > change.updatedAt) {
            // Local is newer — skip, it will push next cycle
            continue;
          }

          const hadLocal = !!local;
          await applyChange("entry", change.id, decrypted, false);
          changedIds.push(change.id);

          if (hadLocal) {
            emit({
              type: "conflict-resolved",
              detail: {
                conflictTitle: (decrypted as Entry).title,
                conflictType: "updated",
              },
            });
          }
        } else {
          // Settings and vault_meta: always apply remote version
          await applyChange(change.recordType, change.id, decrypted, false);
          changedIds.push(change.id);
        }
      }
    } finally {
      setSyncing(false);
    }

    hasMore = response.hasMore;
    cursor = response.cursor ?? undefined;

    if (response.serverTimestamp) {
      await setLastPullTimestamp(response.serverTimestamp);
    }
  }

  return changedIds;
}

export async function sync(
  getToken: () => Promise<string>,
  cryptoKey: CryptoKey,
): Promise<void> {
  emit({ type: "sync-start" });

  try {
    await push(getToken, cryptoKey);
    const changedIds = await pull(getToken, cryptoKey);
    emit({ type: "sync-complete", detail: { changedIds } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    emit({ type: "sync-error", detail: { error: message } });
    throw err;
  }
}

// T038: Initial device setup — full pull for new devices
export async function initialSync(
  getToken: () => Promise<string>,
  cryptoKey: CryptoKey,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const token = await getToken();
  let cursor: string | undefined;
  let hasMore = true;
  let totalProcessed = 0;

  emit({ type: "sync-start" });

  try {
    while (hasMore) {
      const response = await syncApi.pull(
        token,
        "1970-01-01T00:00:00Z",
        cursor,
        100,
      );

      setSyncing(true);
      try {
        for (const change of response.changes) {
          if (change.isTombstone) continue;

          const decrypted = await decryptFromSync(
            change.encryptedPayload,
            cryptoKey,
          );
          await applyChange(change.recordType, change.id, decrypted, false);
          totalProcessed++;
        }
      } finally {
        setSyncing(false);
      }

      hasMore = response.hasMore;
      cursor = response.cursor ?? undefined;

      if (response.serverTimestamp) {
        await setLastPullTimestamp(response.serverTimestamp);
      }

      if (onProgress) {
        onProgress(totalProcessed);
      }
      emit({
        type: "initial-sync-progress",
        detail: { progress: totalProcessed },
      });
    }

    emit({ type: "sync-complete", detail: { changedIds: [] } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    emit({ type: "sync-error", detail: { error: message } });
    throw err;
  }
}
