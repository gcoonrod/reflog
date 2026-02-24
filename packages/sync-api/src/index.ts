import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { userMiddleware } from "./middleware/user";
import { inviteMiddleware } from "./middleware/invite";
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
import { inviteRoutes } from "./routes/invites";
import { waitlistRoutes } from "./routes/waitlist";
import { betaRoutes } from "./routes/beta";

export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  ALLOWED_ORIGINS: string;
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

export interface ParsedPushBody {
  changes: unknown[];
  deviceId: string;
  lastPullTimestamp: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthContext;
    user: UserContext;
    parsedPushBody?: ParsedPushBody;
  };
};

const app = new Hono<AppEnv>();

// Global middleware (all routes)
app.use("*", corsMiddleware);
app.use("*", ipRateLimitMiddleware);
app.use("*", bodySizeMiddleware);
app.use("*", contentTypeMiddleware);

// Public routes (no auth required)
app.route("/api/v1/health", healthRoutes);
app.route("/api/v1/waitlist", waitlistRoutes);
app.route("/api/v1/beta", betaRoutes);

// Auth + user middleware for protected route groups
for (const path of [
  "/api/v1/sync/*",
  "/api/v1/devices/*",
  "/api/v1/account/*",
  "/api/v1/invites/*",
]) {
  app.use(path, authMiddleware);
  app.use(path, userMiddleware);
}

// Invite routes (auth required, NOT invite-gated — these check/consume invites)
app.route("/api/v1/invites", inviteRoutes);

// Invite gate for protected data routes (NOT invites — those are the gate itself)
for (const path of [
  "/api/v1/sync/*",
  "/api/v1/devices/*",
  "/api/v1/account/*",
]) {
  app.use(path, inviteMiddleware);
}

// User rate limit for all authenticated routes
for (const path of [
  "/api/v1/sync/*",
  "/api/v1/devices/*",
  "/api/v1/account/*",
  "/api/v1/invites/*",
]) {
  app.use(path, userRateLimitMiddleware);
}

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
      "DELETE FROM sync_records WHERE is_tombstone = 1 AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days')",
    ).run();
    console.log(`Tombstone GC: purged ${result.meta.changes ?? 0} records`);
  },
};
