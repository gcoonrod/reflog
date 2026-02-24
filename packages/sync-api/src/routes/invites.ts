import { Hono } from "hono";
import type { AppEnv } from "../index";
import { findInviteByEmail, consumeInvite } from "../db/queries";

export const inviteRoutes = new Hono<AppEnv>();

// POST /invites/verify — check if authenticated user has a valid invite
inviteRoutes.post("/verify", async (c) => {
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
        error: "invite_required",
        message:
          "A valid invite is required to access Reflog during the beta.",
      },
      403
    );
  }

  // Consumed invites are permanently valid (FR-005)
  if (invite.status === "consumed") {
    return c.json({ status: "valid", email: user.email }, 200);
  }

  // Only pending invites check expiration
  if (invite.status === "pending") {
    const now = new Date().toISOString();
    if (invite.expires_at > now) {
      return c.json({ status: "valid", email: user.email }, 200);
    }
  }

  // Expired, revoked, or other status
  return c.json(
    {
      error: "invite_required",
      message:
        "A valid invite is required to access Reflog during the beta.",
    },
    403
  );
});

// POST /invites/consume — mark invite as consumed on first login
inviteRoutes.post("/consume", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  // Check current invite status
  const invite = await findInviteByEmail(db, user.email).first<{
    id: string;
    status: string;
  }>();

  if (!invite) {
    return c.json(
      {
        error: "invite_required",
        message:
          "A valid invite is required to access Reflog during the beta.",
      },
      403
    );
  }

  if (invite.status === "consumed") {
    return c.json(
      {
        error: "already_consumed",
        message: "This invite has already been used.",
      },
      409
    );
  }

  // Attempt to consume (WHERE status = 'pending' guards against races)
  const result = await consumeInvite(db, user.email, user.userId).run();

  if (result.meta.changes === 0) {
    return c.json(
      {
        error: "invite_required",
        message:
          "A valid invite is required to access Reflog during the beta.",
      },
      403
    );
  }

  return c.json({ status: "consumed", email: user.email }, 200);
});
