import { Hono } from "hono";
import type { AppEnv } from "../index";
import {
  countDevices,
  createDevice,
  deleteDevice,
  findDevice,
  listDevices,
} from "../db/queries";

export const deviceRoutes = new Hono<AppEnv>();

// POST /register — register a new device
deviceRoutes.post("/register", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const body = await c.req.json<{ name: string }>();
  if (!body.name || typeof body.name !== "string") {
    return c.json(
      { error: "bad_request", message: "Missing or invalid 'name' field" },
      400
    );
  }

  // Check device limit (max 10 per user)
  const countResult = await countDevices(db, user.userId).first<{
    count: number;
  }>();
  if (countResult && countResult.count >= 10) {
    return c.json(
      {
        error: "conflict",
        message:
          "Maximum number of devices (10) reached. Remove a device before registering a new one.",
      },
      409
    );
  }

  const deviceId = crypto.randomUUID();
  await createDevice(db, deviceId, user.userId, body.name).run();

  return c.json(
    {
      id: deviceId,
      name: body.name,
      registeredAt: new Date().toISOString(),
    },
    201
  );
});

// GET / — list all devices for the authenticated user
deviceRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const result = await listDevices(db, user.userId).all<{
    id: string;
    name: string;
    registered_at: string;
    last_seen_at: string | null;
  }>();

  return c.json({
    devices: result.results.map((d) => ({
      id: d.id,
      name: d.name,
      registeredAt: d.registered_at,
      lastSeenAt: d.last_seen_at,
    })),
  });
});

// DELETE /:deviceId — remove a device
deviceRoutes.delete("/:deviceId", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const deviceId = c.req.param("deviceId");

  const existing = await findDevice(db, deviceId, user.userId).first();
  if (!existing) {
    return c.json({ error: "not_found", message: "Device not found" }, 404);
  }

  await deleteDevice(db, deviceId, user.userId).run();

  return c.json({ success: true });
});
