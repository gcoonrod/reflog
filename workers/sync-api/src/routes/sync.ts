import { Hono } from "hono";
import type { AppEnv, ParsedPushBody } from "../index";
import {
  upsertSyncRecord,
  findSyncRecord,
  pullSyncRecords,
  pullSyncRecordsWithCursor,
  getUserStorage,
  updateStorageUsed,
} from "../db/queries";

interface PushChange {
  id: string;
  recordType: string;
  encryptedPayload: string;
  isTombstone: boolean;
}

interface PushRequestBody {
  changes: PushChange[];
  deviceId: string;
  lastPullTimestamp: string;
}

interface SyncRecordRow {
  id: string;
  user_id: string;
  record_type: string;
  encrypted_payload: string;
  payload_size_bytes: number;
  is_tombstone: number;
  device_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export const syncRoutes = new Hono<AppEnv>();

// POST /push — push local changes to server
syncRoutes.post("/push", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  // Body already validated and parsed by pushValidationMiddleware
  const parsed = c.get("parsedPushBody") as ParsedPushBody | undefined;
  const body: PushRequestBody = parsed
    ? { changes: parsed.changes as PushChange[], deviceId: parsed.deviceId, lastPullTimestamp: parsed.lastPullTimestamp }
    : await c.req.json<PushRequestBody>();

  if (!Array.isArray(body.changes) || !body.deviceId || !body.lastPullTimestamp) {
    return c.json(
      { error: "bad_request", message: "Missing required fields" },
      400
    );
  }

  if (body.changes.length > 100) {
    return c.json(
      { error: "bad_request", message: "Maximum 100 changes per push" },
      400
    );
  }

  // Check storage quota before processing
  const storageResult = await getUserStorage(db, user.userId).first<{
    storage_used_bytes: number;
    storage_quota_bytes: number;
  }>();

  if (!storageResult) {
    return c.json({ error: "not_found", message: "User not found" }, 404);
  }

  const conflicts: SyncRecordRow[] = [];
  const accepted: string[] = [];
  let totalNewBytes = 0;

  // Process each change: detect conflicts and prepare upserts
  const statements = [];
  for (const change of body.changes) {
    const payloadSizeBytes = new TextEncoder().encode(
      change.encryptedPayload
    ).length;

    // Check for conflicts
    const existing = await findSyncRecord(db, change.id, user.userId).first<SyncRecordRow>();

    if (existing && existing.updated_at > body.lastPullTimestamp) {
      // Conflict: server version was modified since client's last pull
      conflicts.push(existing);
      continue;
    }

    // Calculate storage delta
    const existingSize = existing?.payload_size_bytes ?? 0;
    totalNewBytes += payloadSizeBytes - existingSize;

    statements.push(
      upsertSyncRecord(
        db,
        change.id,
        user.userId,
        change.recordType,
        change.encryptedPayload,
        payloadSizeBytes,
        change.isTombstone,
        body.deviceId
      )
    );
    accepted.push(change.id);
  }

  // Check if new storage would exceed quota
  const projectedUsage = storageResult.storage_used_bytes + totalNewBytes;
  if (projectedUsage > storageResult.storage_quota_bytes) {
    return c.json(
      {
        error: "storage_quota_exceeded",
        message: "Storage quota exceeded",
        storageUsedBytes: storageResult.storage_used_bytes,
        storageQuotaBytes: storageResult.storage_quota_bytes,
      },
      507
    );
  }

  // Execute all upserts atomically
  if (statements.length > 0) {
    statements.push(updateStorageUsed(db, user.userId, totalNewBytes));
    await db.batch(statements);
  }

  return c.json({
    accepted: accepted.length,
    conflicts: conflicts.map((r) => ({
      id: r.id,
      recordType: r.record_type,
      encryptedPayload: r.encrypted_payload,
      isTombstone: r.is_tombstone === 1,
      deviceId: r.device_id,
      version: r.version,
      updatedAt: r.updated_at,
    })),
    serverTimestamp: new Date().toISOString(),
  });
});

// GET /pull — pull remote changes since a timestamp
syncRoutes.get("/pull", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const since = c.req.query("since") ?? "1970-01-01T00:00:00Z";
  const cursor = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "100", 10) || 100, 1), 500);

  let result;
  if (cursor) {
    // Cursor-based pagination: cursor format is "updatedAt|id"
    const [cursorUpdatedAt, cursorId] = cursor.split("|");
    if (!cursorUpdatedAt || !cursorId) {
      return c.json(
        { error: "bad_request", message: "Invalid cursor format" },
        400
      );
    }
    result = await pullSyncRecordsWithCursor(
      db,
      user.userId,
      since,
      cursorUpdatedAt,
      cursorId,
      limit + 1
    ).all<SyncRecordRow>();
  } else {
    result = await pullSyncRecords(db, user.userId, since, limit + 1).all<SyncRecordRow>();
  }

  const records = result.results;
  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;

  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]!;
    nextCursor = `${last.updated_at}|${last.id}`;
  }

  return c.json({
    changes: page.map((r) => ({
      id: r.id,
      recordType: r.record_type,
      encryptedPayload: r.encrypted_payload,
      isTombstone: r.is_tombstone === 1,
      deviceId: r.device_id,
      version: r.version,
      updatedAt: r.updated_at,
    })),
    hasMore,
    cursor: nextCursor,
    serverTimestamp: new Date().toISOString(),
  });
});
