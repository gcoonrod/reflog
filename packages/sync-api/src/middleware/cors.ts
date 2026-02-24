import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

/**
 * Convert a wildcard origin pattern (e.g. "https://*.example.com")
 * into a RegExp that matches against full origin strings.
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const withWildcard = escaped.replace(/\*/g, "[\\w-]+");
  return new RegExp(`^${withWildcard}$`);
}

export function isAllowedOrigin(origin: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      if (patternToRegex(pattern).test(origin)) return true;
    } else {
      if (pattern === origin) return true;
    }
  }
  return false;
}

export function parseOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Cache the cors handler per ALLOWED_ORIGINS value (constant within a Worker instance)
let cachedRaw: string | undefined;
let cachedHandler: ReturnType<typeof cors> | undefined;

export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const raw = c.env.ALLOWED_ORIGINS ?? "";

  if (raw !== cachedRaw) {
    const patterns = parseOrigins(raw);
    cachedHandler = cors({
      origin: (origin) => (isAllowedOrigin(origin, patterns) ? origin : ""),
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 86400,
    });
    cachedRaw = raw;
  }

  return cachedHandler!(c, next);
});
