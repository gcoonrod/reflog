import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { Hono } from "hono";
import { waitlistRoutes } from "../src/routes/waitlist";
import type { Env } from "../src/index";

function createTestApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/waitlist", waitlistRoutes);
  return app;
}

async function req(
  app: Hono<{ Bindings: Env }>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const request = new Request(`https://test.local${path}`, init);
  return app.fetch(request, env as unknown as Env);
}

const SCHEMA_SQL = [
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

describe("POST /waitlist", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM waitlist").run();
  });

  it("adds a valid email to the waitlist", async () => {
    const app = createTestApp();
    const res = await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", consent: true }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("added");

    const row = await env.DB.prepare(
      "SELECT email FROM waitlist WHERE email = ?",
    )
      .bind("new@example.com")
      .first<{ email: string }>();
    expect(row?.email).toBe("new@example.com");
  });

  it("returns 400 when email is missing", async () => {
    const app = createTestApp();
    const res = await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 when consent is not true", async () => {
    const app = createTestApp();
    const res = await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", consent: false }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("consent_required");
  });

  it("returns 409 for duplicate email", async () => {
    const app = createTestApp();

    // First submission
    await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@example.com", consent: true }),
    });

    // Duplicate
    const res = await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@example.com", consent: true }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("exists");
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = createTestApp();
    const res = await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("normalizes email to lowercase and trims whitespace", async () => {
    const app = createTestApp();
    const res = await req(app, "/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "  Test@Example.COM  ", consent: true }),
    });

    expect(res.status).toBe(201);

    const row = await env.DB.prepare(
      "SELECT email FROM waitlist WHERE email = ?",
    )
      .bind("test@example.com")
      .first<{ email: string }>();
    expect(row?.email).toBe("test@example.com");
  });
});
