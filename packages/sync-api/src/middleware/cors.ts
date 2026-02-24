import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

/**
 * Convert a wildcard origin pattern (e.g. "https://*.example.com")
 * into a RegExp that matches against full origin strings.
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const withWildcard = escaped.replace(/\\\*/g, "[\\w-]+");
  return new RegExp(`^${withWildcard}$`);
}

function isAllowedOrigin(origin: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      if (patternToRegex(pattern).test(origin)) return true;
    } else {
      if (pattern === origin) return true;
    }
  }
  return false;
}

export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const raw = c.env.ALLOWED_ORIGINS ?? "";
  const patterns = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const handler = cors({
    origin: (origin) => (isAllowedOrigin(origin, patterns) ? origin : ""),
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  });

  return handler(c, next);
});
