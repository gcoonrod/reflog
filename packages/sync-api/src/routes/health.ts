import { Hono } from "hono";
import type { AppEnv } from "../index";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    return c.json({ status: "error", timestamp: new Date().toISOString() }, 503);
  }

  return c.json({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  });
});
