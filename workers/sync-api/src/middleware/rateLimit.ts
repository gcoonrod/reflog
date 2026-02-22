// T044: Rate limiting middleware using Cloudflare's built-in Rate Limiting binding.
// Two limiters: IP-based for unauthenticated endpoints, user-based for authenticated.

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

export const ipRateLimitMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  if (c.env.RATE_LIMITER_IP) {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await c.env.RATE_LIMITER_IP.limit({ key: ip });

    if (!success) {
      return c.json({ error: "rate_limited", message: "Too many requests" }, 429);
    }
  }

  await next();
};

export const userRateLimitMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  if (c.env.RATE_LIMITER_USER) {
    const user = c.get("user");
    const key = user?.userId ?? "anonymous";
    const { success } = await c.env.RATE_LIMITER_USER.limit({ key });

    if (!success) {
      return c.json({ error: "rate_limited", message: "Too many requests" }, 429);
    }
  }

  await next();
};
