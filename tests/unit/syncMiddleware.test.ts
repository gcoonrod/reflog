// T055: Unit tests for Dexie DBCore sync tracking middleware

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { createDB, type ReflogDB } from "@/db/schema";
import { syncMiddleware, setSyncing, setDbReference } from "@/db/middleware";
import type { Entry } from "@/types";

let db: ReflogDB;

function makeEntry(id: string): Entry {
  return {
    id,
    title: `Entry ${id}`,
    body: "test body",
    tags: [],
    status: "published",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncVersion: 0,
    deletedAt: null,
  };
}

beforeEach(() => {
  db = createDB(`test-sync-mw-${Date.now()}`);
  db.use(syncMiddleware);
  setDbReference(db);
});

afterEach(async () => {
  await db.delete();
});

describe("syncMiddleware", () => {
  it("creates a sync_queue record on entry add", async () => {
    const entry = makeEntry("e1");
    await db.entries.add(entry);

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0]!.tableName).toBe("entries");
    expect(queue[0]!.recordId).toBe("e1");
    expect(queue[0]!.operation).toBe("create");
    expect(queue[0]!.payload).toBeTruthy();
  });

  it("creates a sync_queue record on entry put (update)", async () => {
    const entry = makeEntry("e2");
    await db.entries.add(entry);
    await db.sync_queue.clear(); // Clear the add record

    await db.entries.put({ ...entry, title: "Updated" });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0]!.operation).toBe("update");
    expect(queue[0]!.recordId).toBe("e2");
  });

  it("creates a sync_queue record on entry delete", async () => {
    const entry = makeEntry("e3");
    await db.entries.add(entry);
    await db.sync_queue.clear();

    await db.entries.delete("e3");

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0]!.operation).toBe("delete");
    expect(queue[0]!.recordId).toBe("e3");
    expect(queue[0]!.payload).toBeNull();
  });

  it("does NOT track mutations to sync_queue table", async () => {
    await db.sync_queue.add({
      tableName: "entries",
      recordId: "x",
      operation: "create",
      timestamp: new Date().toISOString(),
      payload: "{}",
    });

    // Only the one we just added should exist, not a recursive tracking record
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
  });

  it("does NOT track mutations to sync_meta table", async () => {
    await db.sync_meta.put({ key: "lastPullTimestamp", value: "2024-01-01" });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  it("suppresses queue writes when isSyncing is true", async () => {
    setSyncing(true);
    try {
      await db.entries.add(makeEntry("e4"));
      const queue = await db.sync_queue.toArray();
      expect(queue.length).toBe(0);
    } finally {
      setSyncing(false);
    }
  });

  it("resumes queue writes when isSyncing is set back to false", async () => {
    setSyncing(true);
    await db.entries.add(makeEntry("e5"));
    setSyncing(false);

    await db.entries.add(makeEntry("e6"));

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0]!.recordId).toBe("e6");
  });

  it("tracks settings table mutations", async () => {
    await db.settings.add({ key: "theme", value: "dark" });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0]!.tableName).toBe("settings");
  });
});
