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

-- Recreate sync_records to apply composite PK (user_id, id).
-- Safe: no production user data exists yet. Remove this DROP once
-- the composite PK is the only schema that has ever been deployed.
DROP TABLE IF EXISTS sync_records;

CREATE TABLE IF NOT EXISTS sync_records (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  payload_size_bytes INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_tombstone INTEGER NOT NULL DEFAULT 0,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sync_records_user_updated
  ON sync_records(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_sync_records_user_type
  ON sync_records(user_id, record_type);

CREATE INDEX IF NOT EXISTS idx_sync_records_tombstone_gc
  ON sync_records(is_tombstone, updated_at);

-- Beta Readiness: Invite system tables
-- See: specs/005-beta-readiness/data-model.md

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  consent INTEGER NOT NULL DEFAULT 1,
  invited INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

CREATE TABLE IF NOT EXISTS beta_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO beta_config (key, value) VALUES ('max_beta_users', '50');
INSERT OR IGNORE INTO beta_config (key, value) VALUES ('invite_expiry_days', '30');
