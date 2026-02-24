import { Hono } from "hono";
import type { AppEnv } from "../index";
import {
  findInviteByEmail,
  consumeInvite,
  countConsumedInvites,
  getBetaConfig,
} from "../db/queries";

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
    // Check if beta is at capacity to return appropriate error
    const [consumedRow, configRow] = await Promise.all([
      countConsumedInvites(db).first<{ count: number }>(),
      getBetaConfig(db, "max_beta_users").first<{ value: string }>(),
    ]);
    const consumed = consumedRow?.count ?? 0;
    const max = parseInt(configRow?.value ?? "0", 10);
    if (max > 0 && consumed >= max) {
      return c.json(
        {
          error: "beta_full" as const,
          message:
            "The Reflog beta is currently at capacity. Join the waitlist to be notified when a spot opens up.",
        },
        403
      );
    }
    return c.json(
      {
        error: "invite_required" as const,
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
    if (new Date(invite.expires_at) > new Date()) {
      return c.json({ status: "valid", email: user.email }, 200);
    }
  }

  // Expired, revoked, or other status
  return c.json(
    {
      error: "invite_required" as const,
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

  // Check capacity before consuming
  const [consumedRow, configRow] = await Promise.all([
    countConsumedInvites(db).first<{ count: number }>(),
    getBetaConfig(db, "max_beta_users").first<{ value: string }>(),
  ]);
  const consumed = consumedRow?.count ?? 0;
  const max = parseInt(configRow?.value ?? "0", 10);
  if (max > 0 && consumed >= max) {
    return c.json(
      {
        error: "beta_full" as const,
        message:
          "The Reflog beta is currently at capacity. Join the waitlist to be notified when a spot opens up.",
      },
      403
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
