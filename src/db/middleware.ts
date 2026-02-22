// T033: Dexie DBCore middleware for sync change tracking.
// Registered BEFORE encryption middleware so it captures plaintext (see quickstart § A1).
// Uses a lazy Dexie reference to write to sync_queue in a separate transaction,
// since DBCore transactions are scoped to the mutated table only.

import type { DBCore, Middleware } from "dexie";
import type { ReflogDB } from "./schema";
import { nowISO } from "@/utils/date";

const SYNCED_TABLES = new Set(["entries", "settings", "vault_meta"]);
const EXCLUDED_TABLES = new Set(["sync_queue", "sync_meta"]);

let _isSyncing = false;
let _db: ReflogDB | null = null;

export function setSyncing(value: boolean): void {
  _isSyncing = value;
}

export function setDbReference(db: ReflogDB): void {
  _db = db;
}

export const syncMiddleware: Middleware<DBCore> = {
  stack: "dbcore",
  name: "SyncTrackingMiddleware",
  create(downlevelDatabase) {
    return {
      ...downlevelDatabase,
      table(tableName: string) {
        const downlevelTable = downlevelDatabase.table(tableName);

        if (EXCLUDED_TABLES.has(tableName) || !SYNCED_TABLES.has(tableName)) {
          return downlevelTable;
        }

        return {
          ...downlevelTable,
          mutate(req) {
            if (_isSyncing) {
              return downlevelTable.mutate(req);
            }

            // Execute the mutation first, then record to sync_queue
            return downlevelTable.mutate(req).then((result) => {
              if (!_db) return result;

              const timestamp = nowISO();

              interface QueueEntry {
                tableName: string;
                recordId: string;
                operation: "create" | "update" | "delete";
                timestamp: string;
                payload: string | null;
              }

              const entries: QueueEntry[] = [];

              if (req.type === "add" || req.type === "put") {
                const values = req.values as Record<string, unknown>[];
                for (const value of values) {
                  const recordId = (value.id ?? value.key) as string;
                  if (recordId) {
                    entries.push({
                      tableName,
                      recordId,
                      operation: req.type === "add" ? "create" : "update",
                      timestamp,
                      payload: JSON.stringify(value),
                    });
                  }
                }
              } else if (req.type === "delete") {
                const keys = req.keys as string[];
                for (const key of keys) {
                  entries.push({
                    tableName,
                    recordId: key,
                    operation: "delete",
                    timestamp,
                    payload: null,
                  });
                }
              }

              if (entries.length > 0) {
                // Write to sync_queue using raw IndexedDB API to bypass
                // Dexie's PSD zone (which inherits the parent transaction scope).
                return new Promise<typeof result>((resolve, reject) => {
                  const db = _db;
                  if (!db) {
                    resolve(result);
                    return;
                  }
                  const idb = db.backendDB();
                  const tx = idb.transaction("sync_queue", "readwrite");
                  const store = tx.objectStore("sync_queue");
                  for (const entry of entries) {
                    store.add(entry);
                  }
                  tx.oncomplete = () => {
                    resolve(result);
                  };
                  tx.onerror = () => {
                    reject(
                      new Error(
                        tx.error?.message ?? "sync_queue transaction failed",
                      ),
                    );
                  };
                });
              }
              return result;
            });
          },
        };
      },
    };
  },
};
