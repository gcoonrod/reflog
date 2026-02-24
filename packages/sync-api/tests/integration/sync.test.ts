// T058: Integration tests for Worker endpoints using @cloudflare/vitest-pool-workers.
// Tests the full sync cycle with a real D1 database: push, pull, conflict detection,
// device registration, account deletion, storage quota enforcement, tombstone GC.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi,
} from "vitest";
import { env } from "cloudflare:test";

// Mock jose so JWT verification always succeeds with a test subject
vi.mock("jose", () => ({
  createRemoteJWKSet: () => () => ({}),
  jwtVerify: async () => ({
    payload: {
      sub: "auth0|test-user-001",
      "https://reflog.app/claims/email": "test@example.com",
    },
    protectedHeader: { alg: "RS256", typ: "JWT" },
  }),
}));

// Import the worker app AFTER mocking jose
const { default: worker } = await import("../../src/index");

const AUTH_HEADER = "Bearer test-token";

function makeCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (!headers.has("Authorization")) headers.set("Authorization", AUTH_HEADER);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  return worker.fetch(
    new Request(`https://test.local/api/v1${path}`, {
      ...init,
      headers,
    }),
    env,
    makeCtx(),
  );
}

// D1 schema — inlined since tests run inside Workers runtime (no local fs access)
const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    auth0_sub TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    storage_used_bytes INTEGER NOT NULL DEFAULT 0,
    storage_quota_bytes INTEGER NOT NULL DEFAULT 52428800
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_auth0_sub ON users(auth0_sub)`,
  `CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)`,
  `CREATE TABLE IF NOT EXISTS sync_records (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    payload_size_bytes INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_tombstone INTEGER NOT NULL DEFAULT 0,
    device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_records_user_updated ON sync_records(user_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_records_user_type ON sync_records(user_id, record_type)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_records_tombstone_gc ON sync_records(is_tombstone, updated_at)`,
  `CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    consumed_by_user_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS beta_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `INSERT OR IGNORE INTO beta_config (key, value) VALUES ('max_beta_users', '50')`,
  `CREATE TABLE IF NOT EXISTS waitlist (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    consent INTEGER NOT NULL DEFAULT 1,
    invited INTEGER NOT NULL DEFAULT 0
  )`,
];

beforeAll(async () => {
  for (const sql of SCHEMA_SQL) {
    await env.DB.prepare(sql).run();
  }
});

beforeEach(async () => {
  // Clean data between tests (preserve schema). Order matters for FK constraints.
  await env.DB.prepare("DELETE FROM sync_records").run();
  await env.DB.prepare("DELETE FROM devices").run();
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM invites").run();
  // Seed a consumed invite for the test user so the invite middleware passes
  await env.DB.prepare(
    `INSERT OR REPLACE INTO invites (id, email, token, status, created_by, expires_at)
     VALUES ('test-invite', 'test@example.com', 'test-token', 'consumed', 'test', datetime('now', '+30 days'))`,
  ).run();
});

describe("health endpoint", () => {
  it("returns 200 with status ok", async () => {
    const res = await worker.fetch(
      new Request("https://test.local/api/v1/health"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});

describe("device registration", () => {
  it("registers a device and returns Device shape", async () => {
    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Test Device" }),
    });

    expect(res.status).toBe(201);
    const device = (await res.json()) as Record<string, unknown>;
    expect(device).toHaveProperty("id");
    expect(device.name).toBe("Test Device");
    expect(device).toHaveProperty("registeredAt");
  });

  it("enforces device limit (max 10)", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request("/devices/register", {
        method: "POST",
        body: JSON.stringify({ name: `Device ${i}` }),
      });
      expect(res.status).toBe(201);
    }

    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Device 11" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("user email self-healing", () => {
  it("syncs email from JWT when user row has empty email", async () => {
    // Seed a user with an empty email (simulates pre-Action state)
    await env.DB.prepare(
      "INSERT INTO users (id, auth0_sub, email) VALUES (?, ?, ?)",
    )
      .bind("user-empty-email", "auth0|test-user-001", "")
      .run();

    // Any authenticated request triggers the user middleware
    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Email Sync Test" }),
    });
    expect(res.status).toBe(201);

    const user = await env.DB.prepare(
      "SELECT email FROM users WHERE id = ?",
    )
      .bind("user-empty-email")
      .first<{ email: string }>();

    expect(user!.email).toBe("test@example.com");
  });

  it("syncs email from JWT when user row has stale email", async () => {
    // Seed a user with a different email
    await env.DB.prepare(
      "INSERT INTO users (id, auth0_sub, email) VALUES (?, ?, ?)",
    )
      .bind("user-stale-email", "auth0|test-user-001", "old@example.com")
      .run();

    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Stale Email Test" }),
    });
    expect(res.status).toBe(201);

    const user = await env.DB.prepare(
      "SELECT email FROM users WHERE id = ?",
    )
      .bind("user-stale-email")
      .first<{ email: string }>();

    expect(user!.email).toBe("test@example.com");
  });
});

describe("sync push", () => {
  let deviceId: string;

  beforeEach(async () => {
    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Push Test Device" }),
    });
    const device = (await res.json()) as { id: string };
    deviceId = device.id;
  });

  it("accepts a push with valid records", async () => {
    const res = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          {
            id: "record-1",
            recordType: "entry",
            encryptedPayload: "encrypted-data-1",
            isTombstone: false,
          },
          {
            id: "record-2",
            recordType: "entry",
            encryptedPayload: "encrypted-data-2",
            isTombstone: false,
          },
        ],
        deviceId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accepted: number;
      conflicts: unknown[];
      serverTimestamp: string;
    };
    expect(body.accepted).toBe(2);
    expect(body.conflicts).toHaveLength(0);
    expect(body.serverTimestamp).toBeDefined();
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes: [] }),
    });

    expect(res.status).toBe(400);
  });
});

describe("sync pull", () => {
  let deviceId: string;

  beforeEach(async () => {
    const regRes = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Pull Test Device" }),
    });
    const device = (await regRes.json()) as { id: string };
    deviceId = device.id;

    await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          { id: "rec-a", recordType: "entry", encryptedPayload: "data-a", isTombstone: false },
          { id: "rec-b", recordType: "entry", encryptedPayload: "data-b", isTombstone: false },
          { id: "rec-c", recordType: "setting", encryptedPayload: "data-c", isTombstone: false },
        ],
        deviceId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });
  });

  it("returns all records since epoch", async () => {
    const res = await request("/sync/pull?since=1970-01-01T00:00:00Z");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      changes: unknown[];
      hasMore: boolean;
      serverTimestamp: string;
    };
    expect(body.changes).toHaveLength(3);
    expect(body.hasMore).toBe(false);
    expect(body.serverTimestamp).toBeDefined();
  });

  it("supports pagination with limit and cursor", async () => {
    const res1 = await request("/sync/pull?since=1970-01-01T00:00:00Z&limit=2");
    expect(res1.status).toBe(200);

    const page1 = (await res1.json()) as {
      changes: unknown[];
      hasMore: boolean;
      cursor: string;
    };
    expect(page1.changes).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBeDefined();

    const res2 = await request(
      `/sync/pull?since=1970-01-01T00:00:00Z&limit=2&cursor=${encodeURIComponent(page1.cursor)}`,
    );
    const page2 = (await res2.json()) as { changes: unknown[]; hasMore: boolean };
    expect(page2.changes).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });
});

describe("conflict detection", () => {
  let deviceAId: string;
  let deviceBId: string;

  beforeEach(async () => {
    const resA = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Device A" }),
    });
    deviceAId = ((await resA.json()) as { id: string }).id;

    const resB = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Device B" }),
    });
    deviceBId = ((await resB.json()) as { id: string }).id;
  });

  it("detects conflict when record modified since lastPullTimestamp", async () => {
    const push1 = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          { id: "shared-1", recordType: "entry", encryptedPayload: "version-A", isTombstone: false },
        ],
        deviceId: deviceAId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });
    expect(push1.status).toBe(200);

    // Device B pushes same record but with old lastPullTimestamp
    const push2 = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          { id: "shared-1", recordType: "entry", encryptedPayload: "version-B", isTombstone: false },
        ],
        deviceId: deviceBId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });

    expect(push2.status).toBe(200);
    const push2Body = (await push2.json()) as {
      accepted: number;
      conflicts: Array<{ id: string; encryptedPayload: string }>;
    };
    expect(push2Body.conflicts).toHaveLength(1);
    expect(push2Body.conflicts[0]!.id).toBe("shared-1");
    expect(push2Body.conflicts[0]!.encryptedPayload).toBe("version-A");
    expect(push2Body.accepted).toBe(0);
  });

  it("accepts push when lastPullTimestamp is after server update", async () => {
    const push1 = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          { id: "shared-2", recordType: "entry", encryptedPayload: "original", isTombstone: false },
        ],
        deviceId: deviceAId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });
    const push1Body = (await push1.json()) as { serverTimestamp: string };

    const push2 = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          { id: "shared-2", recordType: "entry", encryptedPayload: "updated", isTombstone: false },
        ],
        deviceId: deviceBId,
        lastPullTimestamp: push1Body.serverTimestamp,
      }),
    });

    expect(push2.status).toBe(200);
    const push2Body = (await push2.json()) as { accepted: number; conflicts: unknown[] };
    expect(push2Body.accepted).toBe(1);
    expect(push2Body.conflicts).toHaveLength(0);
  });
});

describe("storage quota enforcement", () => {
  let deviceId: string;

  beforeEach(async () => {
    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Quota Test Device" }),
    });
    deviceId = ((await res.json()) as { id: string }).id;
  });

  it("returns 507 when push would exceed quota", async () => {
    const user = await env.DB.prepare(
      "SELECT id FROM users WHERE auth0_sub = ?",
    )
      .bind("auth0|test-user-001")
      .first<{ id: string }>();

    await env.DB.prepare(
      "UPDATE users SET storage_quota_bytes = 100 WHERE id = ?",
    )
      .bind(user!.id)
      .run();

    const res = await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          {
            id: "big-record",
            recordType: "entry",
            encryptedPayload: "x".repeat(200),
            isTombstone: false,
          },
        ],
        deviceId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });

    expect(res.status).toBe(507);
    const body = (await res.json()) as {
      error: string;
      storageQuotaBytes: number;
    };
    expect(body.error).toContain("quota");
    expect(body.storageQuotaBytes).toBe(100);
  });
});

describe("account management", () => {
  let deviceId: string;

  beforeEach(async () => {
    const res = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Account Test Device" }),
    });
    deviceId = ((await res.json()) as { id: string }).id;

    await request("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        changes: [
          { id: "acct-rec", recordType: "entry", encryptedPayload: "data", isTombstone: false },
        ],
        deviceId,
        lastPullTimestamp: "1970-01-01T00:00:00Z",
      }),
    });
  });

  it("returns usage statistics", async () => {
    const res = await request("/account/usage");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("storageUsedBytes");
    expect(body).toHaveProperty("storageQuotaBytes");
    expect(body).toHaveProperty("recordCount");
    expect(body).toHaveProperty("deviceCount");
    expect(body.recordCount).toBe(1);
    expect(body.deviceCount).toBe(1);
  });

  it("exports all encrypted records", async () => {
    const res = await request("/account/export");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      records: Array<{ id: string }>;
      exportedAt: string;
    };
    expect(body.records).toHaveLength(1);
    expect(body.records[0]!.id).toBe("acct-rec");
    expect(body.exportedAt).toBeDefined();
  });

  it("deletes account and cascades to devices and records", async () => {
    const res = await request("/account", { method: "DELETE" });
    expect(res.status).toBe(204);

    const users = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
    expect(users!.count).toBe(0);

    const devices = await env.DB.prepare("SELECT COUNT(*) as count FROM devices").first<{ count: number }>();
    expect(devices!.count).toBe(0);

    const records = await env.DB.prepare("SELECT COUNT(*) as count FROM sync_records").first<{ count: number }>();
    expect(records!.count).toBe(0);
  });
});

describe("tombstone GC (scheduled handler)", () => {
  it("purges tombstones older than 90 days", async () => {
    const regRes = await request("/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "GC Test Device" }),
    });
    const deviceId = ((await regRes.json()) as { id: string }).id;

    const user = await env.DB.prepare(
      "SELECT id FROM users WHERE auth0_sub = ?",
    )
      .bind("auth0|test-user-001")
      .first<{ id: string }>();

    // Old tombstone (>90 days)
    await env.DB.prepare(
      `INSERT INTO sync_records (id, user_id, record_type, encrypted_payload, payload_size_bytes, is_tombstone, device_id, updated_at)
       VALUES (?, ?, 'entry', '', 0, 1, ?, datetime('now', '-100 days'))`,
    )
      .bind("old-tombstone", user!.id, deviceId)
      .run();

    // Recent tombstone (<90 days)
    await env.DB.prepare(
      `INSERT INTO sync_records (id, user_id, record_type, encrypted_payload, payload_size_bytes, is_tombstone, device_id, updated_at)
       VALUES (?, ?, 'entry', '', 0, 1, ?, datetime('now', '-30 days'))`,
    )
      .bind("recent-tombstone", user!.id, deviceId)
      .run();

    // Regular record (not tombstone, old)
    await env.DB.prepare(
      `INSERT INTO sync_records (id, user_id, record_type, encrypted_payload, payload_size_bytes, is_tombstone, device_id, updated_at)
       VALUES (?, ?, 'entry', 'data', 4, 0, ?, datetime('now', '-100 days'))`,
    )
      .bind("regular-old", user!.id, deviceId)
      .run();

    // Run scheduled handler (tombstone GC)
    await worker.scheduled(
      { scheduledTime: Date.now(), cron: "0 3 * * *" } as ScheduledEvent,
      env,
      makeCtx(),
    );

    const remaining = await env.DB.prepare(
      "SELECT id FROM sync_records ORDER BY id",
    ).all<{ id: string }>();

    const ids = remaining.results.map((r) => r.id);
    expect(ids).not.toContain("old-tombstone");
    expect(ids).toContain("recent-tombstone");
    expect(ids).toContain("regular-old");
  });
});
