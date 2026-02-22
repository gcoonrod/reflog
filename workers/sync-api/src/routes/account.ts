import { Hono } from "hono";
import type { AppEnv } from "../index";
import {
  getUserStorage,
  countSyncRecords,
  countDevices,
  deleteUser,
  allSyncRecords,
} from "../db/queries";

export const accountRoutes = new Hono<AppEnv>();

// GET /usage — account storage and usage stats
accountRoutes.get("/usage", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const batchResults = await db.batch([
    getUserStorage(db, user.userId),
    countSyncRecords(db, user.userId),
    countDevices(db, user.userId),
  ]);

  const storage = batchResults[0]?.results[0] as {
    storage_used_bytes: number;
    storage_quota_bytes: number;
  } | undefined;
  const records = batchResults[1]?.results[0] as { count: number } | undefined;
  const devices = batchResults[2]?.results[0] as { count: number } | undefined;

  return c.json({
    storageUsedBytes: storage?.storage_used_bytes ?? 0,
    storageQuotaBytes: storage?.storage_quota_bytes ?? 0,
    recordCount: records?.count ?? 0,
    deviceCount: devices?.count ?? 0,
  });
});

// DELETE / — permanently delete user account
accountRoutes.delete("/", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  // ON DELETE CASCADE handles devices and sync_records cleanup
  await deleteUser(db, user.userId).run();

  return c.json({ success: true });
});

// GET /export — export all user data
accountRoutes.get("/export", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const result = await allSyncRecords(db, user.userId).all<{
    id: string;
    record_type: string;
    encrypted_payload: string;
    is_tombstone: number;
    version: number;
    updated_at: string;
  }>();

  return c.json({
    records: result.results.map((r) => ({
      id: r.id,
      recordType: r.record_type,
      encryptedPayload: r.encrypted_payload,
      isTombstone: r.is_tombstone === 1,
      version: r.version,
      updatedAt: r.updated_at,
    })),
    exportedAt: new Date().toISOString(),
  });
});
