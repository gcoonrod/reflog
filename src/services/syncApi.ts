// T034: Typed HTTP client for the sync API
import type {
  PushRequest,
  PushResponse,
  PullResponse,
  Device,
  AccountUsage,
  ExportResponse,
} from "@/types";

const API_URL = import.meta.env.VITE_SYNC_API_URL as string;

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Unauthorized — token may be expired");
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const error = new Error("Rate limited");
    (error as Error & { retryAfter: number }).retryAfter = retryAfter
      ? parseInt(retryAfter, 10)
      : 60;
    throw error;
  }

  if (response.status === 507) {
    const body = (await response.json()) as Record<string, unknown>;
    const error = new Error("Storage quota exceeded");
    Object.assign(error, body);
    throw error;
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function push(
  token: string,
  req: PushRequest,
): Promise<PushResponse> {
  return request<PushResponse>("/sync/push", token, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function pull(
  token: string,
  since: string,
  cursor?: string,
  limit?: number,
): Promise<PullResponse> {
  const params = new URLSearchParams({ since });
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", limit.toString());

  return request<PullResponse>(`/sync/pull?${params.toString()}`, token);
}

export async function registerDevice(
  token: string,
  name: string,
): Promise<Device> {
  return request<Device>("/devices/register", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteDevice(
  token: string,
  deviceId: string,
): Promise<void> {
  await request(`/devices/${deviceId}`, token, { method: "DELETE" });
}

export async function getUsage(token: string): Promise<AccountUsage> {
  return request<AccountUsage>("/account/usage", token);
}

export async function deleteAccount(token: string): Promise<void> {
  await request("/account", token, { method: "DELETE" });
}

export async function exportData(token: string): Promise<ExportResponse> {
  return request<ExportResponse>("/account/export", token);
}
