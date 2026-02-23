# Data Model: Authentication & Cross-Device Sync

**Feature**: 004-auth-and-sync | **Date**: 2026-02-21

## Overview

This feature introduces a dual-storage model: the existing client-side IndexedDB (Dexie.js) is extended with sync-related tables, and a new server-side D1 (SQLite) database stores encrypted sync records. All data transmitted to the server is encrypted client-side — the server is a zero-knowledge blob store.

## Client-Side Schema (Dexie.js / IndexedDB)

### Existing Tables (Modified)

#### `entries`
The core journal entry table. Extended with sync metadata.

| Field | Type | Description | Change |
|-------|------|-------------|--------|
| `id` | `string` | UUID primary key | Existing |
| `title` | `string` | Entry title | Existing |
| `body` | `string` | Entry body (Markdown) | Existing |
| `tags` | `string[]` | Tag array | Existing |
| `status` | `"draft" \| "published"` | Entry status | Existing |
| `createdAt` | `string` | ISO 8601 creation timestamp | Existing |
| `updatedAt` | `string` | ISO 8601 last update timestamp | Existing |
| `syncVersion` | `number` | Server-assigned version number; 0 for unsynced | **New** |
| `deletedAt` | `string \| null` | ISO 8601 soft-delete timestamp (tombstone); null if active | **New** |

**Index changes**: Add `deletedAt` to compound index for filtering active entries: `[status+createdAt]` → `[status+deletedAt+createdAt]`.

#### `vault_meta`
No schema changes. Vault metadata is **device-local only** and is explicitly excluded from sync. It stores binary cryptographic material (PBKDF2 salt, AES-GCM IV, verification blob) as `Uint8Array` values that cannot survive JSON serialization round-trips. Each device derives its own vault key from the user's passphrase independently.

#### `settings`
No schema changes. Settings sync as regular sync records (type: `setting`).

### New Tables

#### `sync_queue`
Tracks local changes pending sync to server. Written by Dexie DBCore middleware.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Auto-increment primary key |
| `tableName` | `string` | Source table: `"entries"`, `"settings"` |
| `recordId` | `string` | ID of the changed record |
| `operation` | `"create" \| "update" \| "delete"` | Type of change |
| `timestamp` | `string` | ISO 8601 timestamp of local change |
| `payload` | `string \| null` | Serialized record snapshot (null for deletes) |

**Indexes**: `[tableName+recordId]` (for deduplication), `timestamp` (for ordering).

**Lifecycle**: Entries are created by the DBCore middleware on every write. The sync engine reads them in timestamp order, encrypts payloads, pushes to server, and deletes processed entries after server acknowledgment.

**Deduplication**: If multiple mutations exist for the same `tableName+recordId`, only the latest is sent. Earlier entries are discarded during push preparation.

#### `sync_meta`
Tracks sync state for this device.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Primary key: `"lastPullTimestamp"`, `"lastPushTimestamp"`, `"deviceId"`, `"syncEnabled"` |
| `value` | `string` | JSON-encoded value |

**Known keys**:
- `lastPullTimestamp`: ISO 8601 timestamp of last successful pull from server.
- `lastPushTimestamp`: ISO 8601 timestamp of last successful push to server.
- `deviceId`: UUID assigned by server on device registration.
- `syncEnabled`: `"true"` or `"false"` — allows user to pause sync.

### Dexie Schema Migration

```typescript
// Version 2: Add sync support
db.version(2).stores({
  vault_meta: "id",
  entries: "id, status, createdAt, updatedAt, deletedAt, [status+deletedAt+createdAt]",
  settings: "key",
  sync_queue: "++id, [tableName+recordId], timestamp",
  sync_meta: "key",
});
```

## Server-Side Schema (Cloudflare D1 / SQLite)

### `users`
Maps Auth0 identities to internal user records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID generated server-side |
| `auth0_sub` | `TEXT` | UNIQUE NOT NULL | Auth0 `sub` claim (e.g., `auth0\|abc123`) |
| `email` | `TEXT` | NOT NULL | Email from Auth0 (for display only, not auth) |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | ISO 8601 |
| `storage_used_bytes` | `INTEGER` | NOT NULL DEFAULT 0 | Running total of encrypted data stored |
| `storage_quota_bytes` | `INTEGER` | NOT NULL DEFAULT 52428800 | Per-user quota (default 50 MB) |

**Index**: `idx_users_auth0_sub ON users(auth0_sub)`

### `devices`
Tracks registered devices per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID generated server-side |
| `user_id` | `TEXT` | NOT NULL REFERENCES users(id) ON DELETE CASCADE | Owner |
| `name` | `TEXT` | NOT NULL | User-agent or user-provided device name |
| `registered_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | ISO 8601 |
| `last_seen_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | Updated on each sync |

**Index**: `idx_devices_user_id ON devices(user_id)`

### `sync_records`
Encrypted sync data. The server cannot read the `encrypted_payload` field.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID matching client-side record ID |
| `user_id` | `TEXT` | NOT NULL REFERENCES users(id) ON DELETE CASCADE | Owner |
| `record_type` | `TEXT` | NOT NULL | `"entry"`, `"setting"` |
| `encrypted_payload` | `TEXT` | NOT NULL | Base64-encoded AES-256-GCM ciphertext |
| `payload_size_bytes` | `INTEGER` | NOT NULL | Size of encrypted payload (for quota tracking) |
| `version` | `INTEGER` | NOT NULL DEFAULT 1 | Monotonically increasing per record |
| `is_tombstone` | `INTEGER` | NOT NULL DEFAULT 0 | 1 = deleted record |
| `device_id` | `TEXT` | NOT NULL REFERENCES devices(id) | Originating device |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | ISO 8601 |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | Server-assigned, used for LWW |

**Indexes**:
- `idx_sync_records_user_updated ON sync_records(user_id, updated_at)` — for pull queries (delta sync).
- `idx_sync_records_user_type ON sync_records(user_id, record_type)` — for type-filtered queries.
- `idx_sync_records_tombstone_gc ON sync_records(is_tombstone, updated_at)` — for tombstone garbage collection.

### `rate_limits` *(fallback design — not created in initial migration)*

> **Note**: Rate limiting uses Cloudflare's built-in Rate Limiting binding as the primary strategy (see [quickstart.md § A5](./quickstart.md#a5-rate-limiting-strategy-t007-t044)). This table schema is retained as a **fallback migration plan** only — to be used if globally precise counters are needed instead of per-location counters. **Do not include this table in the initial D1 schema migration (T007).**

Sliding window rate limit counters.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | `TEXT` | PRIMARY KEY | `"ip:{addr}"` or `"user:{id}"` |
| `window_start` | `TEXT` | NOT NULL | ISO 8601 start of current window |
| `request_count` | `INTEGER` | NOT NULL DEFAULT 0 | Requests in current window |

**Cleanup**: Rows with `window_start` older than the window duration are deleted periodically.

## Entity Relationships

```
┌──────────┐       1:N       ┌──────────┐
│  users   │────────────────►│ devices  │
└──────┬───┘                 └──────────┘
       │                           │
       │ 1:N                       │ N:1 (originating)
       │                           │
       ▼                           ▼
┌──────────────┐◄──────────────────┘
│ sync_records │
└──────────────┘
```

## State Transitions

### Entry Lifecycle (Client + Sync)

```
                 create              update
  [not exists] ────────► [active] ────────► [active]
                            │                   │
                            │ delete             │ delete
                            ▼                   ▼
                       [tombstone] ◄────────────┘
                            │
                            │ 90 days (server GC)
                            ▼
                       [purged]
```

### Sync Queue Entry Lifecycle

```
  [mutation detected] ──► [queued] ──► [encrypted] ──► [pushed] ──► [deleted]
                            │                              │
                            │ newer mutation                │ push failed
                            │ for same record               │
                            ▼                              ▼
                       [superseded/                    [retry queue]
                        discarded]
```

## Validation Rules

### Client-Side
- Entry `id`: UUID v4 format, generated client-side.
- `title`: Non-empty string, max 500 characters.
- `body`: String, max 100,000 characters.
- `tags`: Array of non-empty strings, max 50 tags, each max 100 characters.
- `status`: Must be `"draft"` or `"published"`.
- `syncVersion`: Non-negative integer. 0 = never synced.
- `deletedAt`: ISO 8601 string or null.

### Server-Side
- `encrypted_payload`: Base64-encoded string, max 256 KB per record.
- `record_type`: Must be one of `"entry"`, `"setting"`.
- `user_id`: Must match authenticated user's ID.
- Total `storage_used_bytes` must not exceed `storage_quota_bytes` (checked on push).

## Data Volume Estimates

| Metric | Value | Basis |
|--------|-------|-------|
| Avg entry size (plaintext) | ~1-2 KB | Title + body + metadata |
| Avg entry size (encrypted) | ~2-3 KB | Encryption + base64 overhead (~50%) |
| Entries per user | Up to 10,000 | Per SC-004 / storage quota |
| Storage per user | ~20-30 MB | 10K entries × 2-3 KB |
| Total storage (1K users) | ~20-30 GB | 1,000 × 20-30 MB |
| Sync payload (typical push) | ~5-15 KB | 1-5 entries per sync |
| Sync payload (initial pull) | ~2-3 MB (compressed) | Full 1K-entry vault |
