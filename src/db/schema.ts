import Dexie, { type EntityTable } from "dexie";
import type { Entry, VaultMeta, Setting } from "@/types";
import { setUpgrading } from "./encryption";
import { setSyncing } from "./middleware";

// Sync-related local table types

export interface SyncQueueEntry {
  id?: number;
  tableName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  timestamp: string;
  payload: string | null;
}

export interface SyncMetaEntry {
  key: string;
  value: string;
}

export type ReflogDB = Dexie & {
  vault_meta: EntityTable<VaultMeta, "id">;
  entries: EntityTable<Entry, "id">;
  settings: EntityTable<Setting, "key">;
  sync_queue: EntityTable<SyncQueueEntry, "id">;
  sync_meta: EntityTable<SyncMetaEntry, "key">;
};

export function createDB(name = "ReflogDB"): ReflogDB {
  const db = new Dexie(name) as ReflogDB;

  db.version(1).stores({
    vault_meta: "id",
    entries: "id, status, createdAt, updatedAt, [status+createdAt]",
    settings: "key",
  });

  db.version(2).stores({
    vault_meta: "id",
    entries:
      "id, status, createdAt, updatedAt, deletedAt, [status+deletedAt+createdAt]",
    settings: "key",
    sync_queue: "++id, [tableName+recordId], timestamp",
    sync_meta: "key",
  }).upgrade(tx => {
    // Backfill new fields on existing entries.
    // Both middlewares must be bypassed during upgrades:
    // - Encryption: vault key isn't available yet, and this only touches
    //   non-encrypted fields (syncVersion, deletedAt)
    // - Sync tracking: backfill mutations shouldn't be queued for sync
    setUpgrading(true);
    setSyncing(true);
    return tx.table("entries").toCollection().modify((entry: Record<string, unknown>) => {
      if (entry.syncVersion === undefined) {
        entry.syncVersion = 0;
      }
      if (entry.deletedAt === undefined) {
        entry.deletedAt = null;
      }
    }).finally(() => {
      setUpgrading(false);
      setSyncing(false);
    });
  });

  return db;
}
