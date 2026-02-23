-- Reflog Sync API — D1 Schema
-- See: specs/004-auth-and-sync/data-model.md § Server-Side Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth0_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,
  storage_quota_bytes INTEGER NOT NULL DEFAULT 52428800
);

CREATE INDEX IF NOT EXISTS idx_users_auth0_sub ON users(auth0_sub);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

CREATE TABLE IF NOT EXISTS sync_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  payload_size_bytes INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_tombstone INTEGER NOT NULL DEFAULT 0,
  device_id TEXT NOT NULL REFERENCES devices(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_records_user_updated
  ON sync_records(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_sync_records_user_type
  ON sync_records(user_id, record_type);

CREATE INDEX IF NOT EXISTS idx_sync_records_tombstone_gc
  ON sync_records(is_tombstone, updated_at);
