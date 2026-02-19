import Dexie, { type EntityTable } from "dexie";
import type { Entry, VaultMeta, Setting } from "@/types";

export type ReflogDB = Dexie & {
  vault_meta: EntityTable<VaultMeta, "id">;
  entries: EntityTable<Entry, "id">;
  settings: EntityTable<Setting, "key">;
};

export function createDB(name = "ReflogDB"): ReflogDB {
  const db = new Dexie(name) as ReflogDB;

  db.version(1).stores({
    vault_meta: "id",
    entries: "id, status, createdAt, updatedAt, [status+createdAt]",
    settings: "key",
  });

  return db;
}
