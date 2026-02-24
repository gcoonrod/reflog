import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { Hono } from "hono";
import { inviteRoutes } from "../src/routes/invites";
import type { AppEnv, Env } from "../src/index";

// Build a minimal test app with a fake auth layer that injects a user context
function createTestApp(email = "test@example.com", userId = "user-1") {
  const app = new Hono<AppEnv>();
  // Mock auth + user middleware — sets the variables that real middleware would
  app.use("*", async (c, next) => {
    c.set("auth", { auth0Sub: "auth0|test-sub", email });
    c.set("user", { userId, auth0Sub: "auth0|test-sub", email });
    await next();
  });
  app.route("/invites", inviteRoutes);
  return app;
}

async function req(
  app: Hono<AppEnv>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const request = new Request(`https://test.local${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  return app.fetch(request, env as unknown as Env);
}

const SCHEMA_SQL = [
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
  `INSERT OR IGNORE INTO beta_config (key, value) VALUES ('invite_expiry_days', '30')`,
];

async function insertInvite(
  db: D1Database,
  email: string,
  status: string,
  expiresAt: string,
) {
  await db
    .prepare(
      `INSERT INTO invites (id, email, token, status, created_by, expires_at)
       VALUES (?, ?, ?, ?, 'test', ?)`,
    )
    .bind(crypto.randomUUID(), email, crypto.randomUUID(), status, expiresAt)
    .run();
}

function futureDate(days = 30): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function pastDate(days = 1): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

beforeAll(async () => {
  for (const sql of SCHEMA_SQL) {
    await env.DB.prepare(sql).run();
  }
});

describe("POST /invites/verify", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM invites").run();
    await env.DB.prepare(
      "UPDATE beta_config SET value = '50' WHERE key = 'max_beta_users'",
    ).run();
  });

  it("returns valid for a consumed invite", async () => {
    await insertInvite(env.DB, "test@example.com", "consumed", futureDate());
    const app = createTestApp("test@example.com");

    const res = await req(app, "/invites/verify", { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("valid");
  });

  it("returns valid for a pending non-expired invite", async () => {
    await insertInvite(env.DB, "test@example.com", "pending", futureDate());
    const app = createTestApp("test@example.com");

    const res = await req(app, "/invites/verify", { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("valid");
  });

  it("returns 403 for a pending expired invite", async () => {
    await insertInvite(env.DB, "test@example.com", "pending", pastDate());
    const app = createTestApp("test@example.com");

    const res = await req(app, "/invites/verify", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invite_required");
  });

  it("returns 403 for a revoked invite", async () => {
    await insertInvite(env.DB, "test@example.com", "revoked", futureDate());
    const app = createTestApp("test@example.com");

    const res = await req(app, "/invites/verify", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invite_required");
  });

  it("returns invite_required when no invite exists", async () => {
    const app = createTestApp("nobody@example.com");

    const res = await req(app, "/invites/verify", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invite_required");
  });

  it("returns beta_full when no invite and capacity reached", async () => {
    await env.DB.prepare(
      "UPDATE beta_config SET value = '1' WHERE key = 'max_beta_users'",
    ).run();
    await insertInvite(env.DB, "other@example.com", "consumed", futureDate());

    const app = createTestApp("nobody@example.com");
    const res = await req(app, "/invites/verify", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("beta_full");
  });
});

describe("POST /invites/consume", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM invites").run();
    await env.DB.prepare(
      "UPDATE beta_config SET value = '50' WHERE key = 'max_beta_users'",
    ).run();
  });

  it("consumes a pending invite", async () => {
    await insertInvite(env.DB, "test@example.com", "pending", futureDate());
    const app = createTestApp("test@example.com", "user-1");

    const res = await req(app, "/invites/consume", { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("consumed");

    const row = await env.DB.prepare(
      "SELECT status FROM invites WHERE email = ?",
    )
      .bind("test@example.com")
      .first<{ status: string }>();
    expect(row?.status).toBe("consumed");
  });

  it("returns 409 for already consumed invite", async () => {
    await insertInvite(env.DB, "test@example.com", "consumed", futureDate());
    const app = createTestApp("test@example.com");

    const res = await req(app, "/invites/consume", { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("already_consumed");
  });

  it("returns 403 when no invite exists", async () => {
    const app = createTestApp("nobody@example.com");

    const res = await req(app, "/invites/consume", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invite_required");
  });

  it("returns beta_full when capacity reached", async () => {
    await env.DB.prepare(
      "UPDATE beta_config SET value = '1' WHERE key = 'max_beta_users'",
    ).run();
    await insertInvite(env.DB, "other@example.com", "consumed", futureDate());
    await insertInvite(env.DB, "test@example.com", "pending", futureDate());

    const app = createTestApp("test@example.com");
    const res = await req(app, "/invites/consume", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("beta_full");
  });
});
