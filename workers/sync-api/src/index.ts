import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { userMiddleware } from "./middleware/user";
import {
  ipRateLimitMiddleware,
  userRateLimitMiddleware,
} from "./middleware/rateLimit";
import {
  bodySizeMiddleware,
  contentTypeMiddleware,
  pushValidationMiddleware,
} from "./middleware/validation";
import { healthRoutes } from "./routes/health";
import { syncRoutes } from "./routes/sync";
import { deviceRoutes } from "./routes/devices";
import { accountRoutes } from "./routes/account";

export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  RATE_LIMITER_IP: RateLimiter;
  RATE_LIMITER_USER: RateLimiter;
}

export interface AuthContext {
  auth0Sub: string;
  email: string;
}

export interface UserContext {
  userId: string;
  auth0Sub: string;
  email: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthContext;
    user: UserContext;
  };
};

const app = new Hono<AppEnv>();

// Global middleware
app.use("*", corsMiddleware);
app.use("*", ipRateLimitMiddleware);
app.use("*", bodySizeMiddleware);
app.use("*", contentTypeMiddleware);

// Public routes (no auth)
app.route("/api/v1/health", healthRoutes);

// Protected routes (auth required, then user lookup/creation, then user rate limit)
app.use("/api/v1/*", authMiddleware);
app.use("/api/v1/*", userMiddleware);
app.use("/api/v1/*", userRateLimitMiddleware);

// Sync push validation
app.use("/api/v1/sync/*", pushValidationMiddleware);

app.route("/api/v1/sync", syncRoutes);
app.route("/api/v1/devices", deviceRoutes);
app.route("/api/v1/account", accountRoutes);

// T047: Tombstone GC — scheduled daily at 3 AM UTC via [triggers] crons
export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const result = await env.DB.prepare(
      "DELETE FROM sync_records WHERE is_tombstone = 1 AND updated_at < datetime('now', '-90 days')",
    ).run();
    console.log(`Tombstone GC: purged ${result.meta.changes ?? 0} records`);
  },
};
