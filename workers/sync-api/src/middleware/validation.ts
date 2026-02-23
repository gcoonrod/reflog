// T045: Request validation middleware — size limits, content type, and push body validation.

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

const MAX_BODY_SIZE = 256 * 1024; // 256 KB
const MAX_PUSH_CHANGES = 100;
const MAX_ENCRYPTED_PAYLOAD_LENGTH = 350_000;

export const bodySizeMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return c.json(
      { error: "payload_too_large", message: "Request body exceeds 256KB" },
      413,
    );
  }

  await next();
};

export const contentTypeMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  if (c.req.method === "POST") {
    const ct = c.req.header("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return c.json(
        {
          error: "invalid_content_type",
          message: "Content-Type must be application/json",
        },
        415,
      );
    }
  }

  await next();
};

export const pushValidationMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  if (c.req.method !== "POST" || !c.req.path.endsWith("/push")) {
    return next();
  }

  const body = await c.req.json<{
    changes?: unknown[];
    deviceId?: string;
    lastPullTimestamp?: string;
  }>();

  if (!body.deviceId || typeof body.deviceId !== "string") {
    return c.json(
      { error: "bad_request", message: "deviceId is required" },
      400,
    );
  }

  if (!body.lastPullTimestamp || typeof body.lastPullTimestamp !== "string") {
    return c.json(
      { error: "bad_request", message: "lastPullTimestamp is required" },
      400,
    );
  }

  if (!Array.isArray(body.changes)) {
    return c.json(
      { error: "bad_request", message: "changes must be an array" },
      400,
    );
  }

  if (body.changes.length > MAX_PUSH_CHANGES) {
    return c.json(
      {
        error: "bad_request",
        message: `changes array exceeds maximum of ${MAX_PUSH_CHANGES} items`,
      },
      400,
    );
  }

  for (const change of body.changes) {
    const rec = change as Record<string, unknown>;
    if (
      typeof rec.encryptedPayload === "string" &&
      rec.encryptedPayload.length > MAX_ENCRYPTED_PAYLOAD_LENGTH
    ) {
      return c.json(
        {
          error: "bad_request",
          message: `encryptedPayload exceeds maximum length of ${MAX_ENCRYPTED_PAYLOAD_LENGTH}`,
        },
        400,
      );
    }
  }

  // Store parsed body on context so the handler doesn't re-read the stream
  c.set("parsedPushBody", {
    changes: body.changes,
    deviceId: body.deviceId,
    lastPullTimestamp: body.lastPullTimestamp,
  });

  await next();
};
