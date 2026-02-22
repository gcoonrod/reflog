import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import {
  findUserByAuth0Sub,
  createUser,
  updateDeviceLastSeen,
  findDevice,
} from "../db/queries";

export const userMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.get("auth");
  const db = c.env.DB;

  const result = await findUserByAuth0Sub(db, auth.auth0Sub).first<{
    id: string;
    auth0_sub: string;
    email: string;
  }>();

  let userId: string;

  if (result) {
    userId = result.id;
    c.set("user", {
      userId: result.id,
      auth0Sub: result.auth0_sub,
      email: result.email,
    });
  } else {
    userId = crypto.randomUUID();
    await createUser(db, userId, auth.auth0Sub, auth.email).run();

    c.set("user", {
      userId,
      auth0Sub: auth.auth0Sub,
      email: auth.email,
    });
  }

  // Update device last_seen_at if deviceId is present in request
  const deviceId =
    c.req.query("deviceId") ??
    (c.req.method === "POST"
      ? ((await c.req.raw.clone().json().catch(() => ({}))) as Record<string, unknown>)
          .deviceId as string | undefined
      : undefined);

  if (deviceId) {
    const device = await findDevice(db, deviceId, userId).first();
    if (device) {
      await updateDeviceLastSeen(db, deviceId).run();
    }
  }

  await next();
});
