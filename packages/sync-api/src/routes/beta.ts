import { Hono } from "hono";
import type { Env } from "../index";
import { getBetaConfig, countConsumedInvites } from "../db/queries";

// Public routes — no auth required
export const betaRoutes = new Hono<{ Bindings: Env }>();

// GET /beta/status — return beta capacity info (no user counts exposed)
betaRoutes.get("/status", async (c) => {
  const db = c.env.DB;

  const maxResult = await getBetaConfig(db, "max_beta_users").first<{
    value: string;
  }>();
  const maxUsers = parseInt(maxResult?.value ?? "50", 10);

  const countResult = await countConsumedInvites(db).first<{
    count: number;
  }>();
  const currentUsers = countResult?.count ?? 0;

  return c.json({
    accepting_signups: currentUsers < maxUsers,
    waitlist_open: true,
  });
});
