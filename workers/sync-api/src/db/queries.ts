// D1 prepared statement builders
// See: data-model.md § Server-Side Schema for column definitions

// --- Users ---

export function findUserByAuth0Sub(db: D1Database, auth0Sub: string) {
  return db
    .prepare("SELECT * FROM users WHERE auth0_sub = ?")
    .bind(auth0Sub);
}

export function createUser(
  db: D1Database,
  id: string,
  auth0Sub: string,
  email: string
) {
  return db
    .prepare(
      "INSERT INTO users (id, auth0_sub, email) VALUES (?, ?, ?)"
    )
    .bind(id, auth0Sub, email);
}

export function deleteUser(db: D1Database, userId: string) {
  return db.prepare("DELETE FROM users WHERE id = ?").bind(userId);
}

export function updateStorageUsed(
  db: D1Database,
  userId: string,
  deltaBytes: number
) {
  return db
    .prepare(
      "UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?"
    )
    .bind(deltaBytes, userId);
}

export function getUserStorage(db: D1Database, userId: string) {
  return db
    .prepare(
      "SELECT storage_used_bytes, storage_quota_bytes FROM users WHERE id = ?"
    )
    .bind(userId);
}

// --- Devices ---

export function listDevices(db: D1Database, userId: string) {
  return db
    .prepare("SELECT * FROM devices WHERE user_id = ? ORDER BY registered_at")
    .bind(userId);
}

export function countDevices(db: D1Database, userId: string) {
  return db
    .prepare("SELECT COUNT(*) as count FROM devices WHERE user_id = ?")
    .bind(userId);
}

export function createDevice(
  db: D1Database,
  id: string,
  userId: string,
  name: string
) {
  return db
    .prepare(
      "INSERT INTO devices (id, user_id, name) VALUES (?, ?, ?)"
    )
    .bind(id, userId, name);
}

export function deleteDevice(
  db: D1Database,
  deviceId: string,
  userId: string
) {
  return db
    .prepare("DELETE FROM devices WHERE id = ? AND user_id = ?")
    .bind(deviceId, userId);
}

export function findDevice(
  db: D1Database,
  deviceId: string,
  userId: string
) {
  return db
    .prepare("SELECT * FROM devices WHERE id = ? AND user_id = ?")
    .bind(deviceId, userId);
}

export function updateDeviceLastSeen(db: D1Database, deviceId: string) {
  return db
    .prepare(
      "UPDATE devices SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    )
    .bind(deviceId);
}

// --- Sync Records ---

export function upsertSyncRecord(
  db: D1Database,
  id: string,
  userId: string,
  recordType: string,
  encryptedPayload: string,
  payloadSizeBytes: number,
  isTombstone: boolean,
  deviceId: string
) {
  return db
    .prepare(
      `INSERT INTO sync_records (id, user_id, record_type, encrypted_payload, payload_size_bytes, is_tombstone, device_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(id) DO UPDATE SET
         encrypted_payload = excluded.encrypted_payload,
         payload_size_bytes = excluded.payload_size_bytes,
         is_tombstone = excluded.is_tombstone,
         device_id = excluded.device_id,
         version = sync_records.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    )
    .bind(
      id,
      userId,
      recordType,
      encryptedPayload,
      payloadSizeBytes,
      isTombstone ? 1 : 0,
      deviceId
    );
}

export function findSyncRecord(
  db: D1Database,
  id: string,
  userId: string
) {
  return db
    .prepare("SELECT * FROM sync_records WHERE id = ? AND user_id = ?")
    .bind(id, userId);
}

export function pullSyncRecords(
  db: D1Database,
  userId: string,
  since: string,
  limit: number
) {
  return db
    .prepare(
      `SELECT * FROM sync_records
       WHERE user_id = ? AND updated_at > ?
       ORDER BY updated_at ASC
       LIMIT ?`
    )
    .bind(userId, since, limit);
}

export function pullSyncRecordsWithCursor(
  db: D1Database,
  userId: string,
  since: string,
  cursorUpdatedAt: string,
  cursorId: string,
  limit: number
) {
  return db
    .prepare(
      `SELECT * FROM sync_records
       WHERE user_id = ? AND updated_at > ?
         AND (updated_at > ? OR (updated_at = ? AND id > ?))
       ORDER BY updated_at ASC, id ASC
       LIMIT ?`
    )
    .bind(userId, since, cursorUpdatedAt, cursorUpdatedAt, cursorId, limit);
}

export function countSyncRecords(db: D1Database, userId: string) {
  return db
    .prepare("SELECT COUNT(*) as count FROM sync_records WHERE user_id = ?")
    .bind(userId);
}

export function allSyncRecords(db: D1Database, userId: string) {
  return db
    .prepare(
      "SELECT * FROM sync_records WHERE user_id = ? ORDER BY updated_at ASC"
    )
    .bind(userId);
}

export function calculateStorageUsed(db: D1Database, userId: string) {
  return db
    .prepare(
      "SELECT COALESCE(SUM(payload_size_bytes), 0) as total FROM sync_records WHERE user_id = ?"
    )
    .bind(userId);
}

export function deleteTombstones(db: D1Database, olderThanDays: number) {
  return db
    .prepare(
      `DELETE FROM sync_records
       WHERE is_tombstone = 1
         AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-' || ? || ' days')`
    )
    .bind(olderThanDays);
}
