import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { findInviteByEmail } from "../db/queries";

// Cache invite verification per request lifecycle to avoid repeated DB lookups.
// The cache is keyed by email and stored in the Hono context variables.

export const inviteMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  const db = c.env.DB;

  const invite = await findInviteByEmail(db, user.email).first<{
    id: string;
    status: string;
    expires_at: string;
  }>();

  if (!invite) {
    return c.json(
      {
        error: "invite_required" as const,
        message:
          "A valid invite is required to access Reflog during the beta.",
      },
      403
    );
  }

  // FR-005: Consumed invites are permanently valid.
  // Only pending invites check expiration.
  if (invite.status === "consumed") {
    await next();
    return;
  }

  if (invite.status === "pending") {
    const now = new Date().toISOString();
    if (invite.expires_at > now) {
      // Valid pending invite — allow access
      await next();
      return;
    }
    // Pending but expired
    return c.json(
      {
        error: "invite_required" as const,
        message:
          "A valid invite is required to access Reflog during the beta.",
      },
      403
    );
  }

  // Revoked or any other status
  return c.json(
    {
      error: "invite_required" as const,
      message:
        "A valid invite is required to access Reflog during the beta.",
    },
    403
  );
});
