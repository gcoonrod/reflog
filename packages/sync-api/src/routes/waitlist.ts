import { Hono } from "hono";
import type { Env } from "../index";
import { createWaitlistEntry, findWaitlistByEmail } from "../db/queries";

// Public routes — no auth required, IP rate limited only
export const waitlistRoutes = new Hono<{ Bindings: Env }>();

// POST /waitlist — add email to the beta waitlist
waitlistRoutes.post("/", async (c) => {
  const body = await c.req.json<{ email?: string; consent?: boolean }>();

  if (!body.email || typeof body.email !== "string") {
    return c.json(
      { error: "invalid_request", message: "A valid email address is required." },
      400
    );
  }

  if (body.consent !== true) {
    return c.json(
      {
        error: "consent_required",
        message:
          "You must consent to the privacy policy to join the waitlist.",
      },
      400
    );
  }

  const email = body.email.trim().toLowerCase();

  // Check for existing entry
  const existing = await findWaitlistByEmail(c.env.DB, email).first();
  if (existing) {
    return c.json(
      {
        status: "exists",
        message: "This email is already on the waitlist.",
      },
      409
    );
  }

  const id = crypto.randomUUID();
  await createWaitlistEntry(c.env.DB, id, email, 1).run();

  return c.json(
    {
      status: "added",
      message: "You have been added to the waitlist.",
    },
    201
  );
});
