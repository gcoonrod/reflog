import db from "@/db";

const SYNC_API_URL = import.meta.env.VITE_SYNC_API_URL as string;

export async function registerDeviceIfNeeded(
  getToken: () => Promise<string>,
): Promise<string | null> {
  // Check if device is already registered
  const existing = await db.sync_meta.get("deviceId");
  if (existing) {
    return existing.value;
  }

  const token = await getToken();
  const deviceName = navigator.userAgent;

  const response = await fetch(`${SYNC_API_URL}/devices/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: deviceName }),
  });

  if (!response.ok) {
    throw new Error(
      `Device registration failed: ${response.status} ${response.statusText}`,
    );
  }

  const device = (await response.json()) as { id: string };
  await db.sync_meta.put({ key: "deviceId", value: device.id });

  return device.id;
}

export async function performLogout(clearData: boolean): Promise<void> {
  if (clearData) {
    await db.entries.clear();
    await db.sync_queue.clear();
    await db.sync_meta.clear();
    await db.settings.clear();
  }
}
