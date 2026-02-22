// T057: Contract tests — validate syncApi client handles responses
// matching the OpenAPI schema in contracts/sync-api.yaml.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  PushResponse,
  PullResponse,
  Device,
  AccountUsage,
  ExportResponse,
} from "@/types";

// Mock import.meta.env before importing syncApi
vi.stubEnv("VITE_SYNC_API_URL", "https://sync.test.local/api/v1");

const TOKEN = "test-bearer-token";

// Dynamically import after env stub
let syncApi: typeof import("@/services/syncApi");

beforeEach(async () => {
  vi.restoreAllMocks();
  syncApi = await import("@/services/syncApi");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

describe("401 Unauthorized", () => {
  it("push throws on missing/invalid token", async () => {
    mockFetch(401, { error: "unauthorized", message: "Missing or invalid Authorization header" });

    await expect(
      syncApi.push(TOKEN, {
        changes: [],
        deviceId: "device-1",
        lastPullTimestamp: "2024-01-01T00:00:00Z",
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("pull throws on missing/invalid token", async () => {
    mockFetch(401, { error: "unauthorized", message: "Invalid or expired token" });

    await expect(
      syncApi.pull(TOKEN, "2024-01-01T00:00:00Z"),
    ).rejects.toThrow("Unauthorized");
  });

  it("getUsage throws on missing/invalid token", async () => {
    mockFetch(401, { error: "unauthorized", message: "Missing or invalid Authorization header" });

    await expect(syncApi.getUsage(TOKEN)).rejects.toThrow("Unauthorized");
  });
});

describe("429 Rate Limited", () => {
  it("throws with retryAfter from Retry-After header", async () => {
    mockFetch(
      429,
      { error: "rate_limited", message: "Too many requests" },
      { "Retry-After": "30" },
    );

    try {
      await syncApi.push(TOKEN, {
        changes: [],
        deviceId: "device-1",
        lastPullTimestamp: "2024-01-01T00:00:00Z",
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      const error = err as Error & { retryAfter: number };
      expect(error.message).toBe("Rate limited");
      expect(error.retryAfter).toBe(30);
    }
  });

  it("defaults retryAfter to 60 when header missing", async () => {
    mockFetch(429, { error: "rate_limited", message: "Too many requests" });

    try {
      await syncApi.pull(TOKEN, "2024-01-01T00:00:00Z");
      expect.unreachable("Should have thrown");
    } catch (err) {
      const error = err as Error & { retryAfter: number };
      expect(error.message).toBe("Rate limited");
      expect(error.retryAfter).toBe(60);
    }
  });
});

describe("507 Quota Exceeded", () => {
  it("throws with quota details from response body", async () => {
    const quotaBody = {
      error: "storage_quota_exceeded",
      storageUsedBytes: 50_000_000,
      storageQuotaBytes: 50_000_000,
      message: "Account storage quota exceeded. Delete entries or contact support.",
    };
    mockFetch(507, quotaBody);

    try {
      await syncApi.push(TOKEN, {
        changes: [
          {
            id: "rec-1",
            recordType: "entry",
            encryptedPayload: "encrypted-blob",
            deviceId: "device-1",
          },
        ],
        deviceId: "device-1",
        lastPullTimestamp: "2024-01-01T00:00:00Z",
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      const error = err as Error & {
        error: string;
        storageUsedBytes: number;
        storageQuotaBytes: number;
      };
      // Object.assign copies body.message onto the Error, overwriting the initial message
      expect(error.message).toContain("storage quota exceeded");
      expect(error.error).toBe("storage_quota_exceeded");
      expect(error.storageUsedBytes).toBe(50_000_000);
      expect(error.storageQuotaBytes).toBe(50_000_000);
    }
  });
});

describe("413 Payload Too Large", () => {
  it("throws on oversized request body", async () => {
    mockFetch(413, { error: "payload_too_large", message: "Request body exceeds 256KB" });

    await expect(
      syncApi.push(TOKEN, {
        changes: [
          {
            id: "rec-1",
            recordType: "entry",
            encryptedPayload: "x".repeat(300_000),
            deviceId: "device-1",
          },
        ],
        deviceId: "device-1",
        lastPullTimestamp: "2024-01-01T00:00:00Z",
      }),
    ).rejects.toThrow("API error: 413");
  });
});

describe("Push response shape (PushResponse)", () => {
  it("matches OpenAPI PushResponse schema", async () => {
    const pushResponse: PushResponse = {
      accepted: 3,
      conflicts: [
        {
          id: "conflict-1",
          recordType: "entry",
          encryptedPayload: "server-version-blob",
          isTombstone: false,
          deviceId: "other-device",
          version: 5,
          updatedAt: "2024-06-01T12:00:00Z",
        },
      ],
      serverTimestamp: "2024-06-01T12:05:00Z",
    };
    mockFetch(200, pushResponse);

    const result = await syncApi.push(TOKEN, {
      changes: [],
      deviceId: "device-1",
      lastPullTimestamp: "2024-01-01T00:00:00Z",
    });

    expect(result).toHaveProperty("accepted");
    expect(typeof result.accepted).toBe("number");
    expect(result).toHaveProperty("conflicts");
    expect(Array.isArray(result.conflicts)).toBe(true);
    expect(result).toHaveProperty("serverTimestamp");
    expect(typeof result.serverTimestamp).toBe("string");

    // Validate conflict record shape
    const conflict = result.conflicts[0]!;
    expect(conflict).toHaveProperty("id");
    expect(conflict).toHaveProperty("recordType");
    expect(conflict).toHaveProperty("encryptedPayload");
    expect(conflict).toHaveProperty("version");
    expect(conflict).toHaveProperty("updatedAt");
  });
});

describe("Pull response shape (PullResponse)", () => {
  it("matches OpenAPI PullResponse schema — no pagination", async () => {
    const pullResponse: PullResponse = {
      changes: [
        {
          id: "rec-1",
          recordType: "entry",
          encryptedPayload: "encrypted-blob",
          isTombstone: false,
          deviceId: "device-a",
          version: 1,
          updatedAt: "2024-06-01T12:00:00Z",
        },
      ],
      hasMore: false,
      serverTimestamp: "2024-06-01T12:05:00Z",
    };
    mockFetch(200, pullResponse);

    const result = await syncApi.pull(TOKEN, "2024-01-01T00:00:00Z");

    expect(result).toHaveProperty("changes");
    expect(Array.isArray(result.changes)).toBe(true);
    expect(result).toHaveProperty("hasMore");
    expect(result.hasMore).toBe(false);
    expect(result).toHaveProperty("serverTimestamp");
    expect(result).not.toHaveProperty("cursor");
  });

  it("matches OpenAPI PullResponse schema — with pagination cursor", async () => {
    const pullResponse: PullResponse = {
      changes: [],
      hasMore: true,
      cursor: "2024-06-01T12:00:00Z|rec-100",
      serverTimestamp: "2024-06-01T12:05:00Z",
    };
    mockFetch(200, pullResponse);

    const result = await syncApi.pull(TOKEN, "2024-01-01T00:00:00Z");

    expect(result.hasMore).toBe(true);
    expect(result.cursor).toBeDefined();
    expect(typeof result.cursor).toBe("string");
  });
});

describe("Device registration response shape", () => {
  it("matches OpenAPI Device schema", async () => {
    const device: Device = {
      id: "device-uuid",
      name: "Chrome on macOS",
      registeredAt: "2024-06-01T12:00:00Z",
      lastSeenAt: "2024-06-01T12:00:00Z",
    };
    mockFetch(201, device);

    // registerDevice hits POST /devices/register
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(device), { status: 200 }),
    );

    const result = await syncApi.registerDevice(TOKEN, "Chrome on macOS");

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("registeredAt");
    expect(result).toHaveProperty("lastSeenAt");
    expect(typeof result.id).toBe("string");
  });
});

describe("Account usage response shape", () => {
  it("matches OpenAPI AccountUsage schema", async () => {
    const usage: AccountUsage = {
      storageUsedBytes: 1_234_567,
      storageQuotaBytes: 50_000_000,
      recordCount: 42,
      deviceCount: 2,
    };
    mockFetch(200, usage);

    const result = await syncApi.getUsage(TOKEN);

    expect(result).toHaveProperty("storageUsedBytes");
    expect(result).toHaveProperty("storageQuotaBytes");
    expect(result).toHaveProperty("recordCount");
    expect(result).toHaveProperty("deviceCount");
    expect(typeof result.storageUsedBytes).toBe("number");
    expect(typeof result.storageQuotaBytes).toBe("number");
    expect(typeof result.recordCount).toBe("number");
    expect(typeof result.deviceCount).toBe("number");
  });
});

describe("Export response shape", () => {
  it("matches OpenAPI ExportResponse schema", async () => {
    const exportResp: ExportResponse = {
      records: [
        {
          id: "rec-1",
          recordType: "entry",
          encryptedPayload: "blob",
          deviceId: "device-1",
          version: 1,
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      exportedAt: "2024-06-01T12:00:00Z",
    };
    mockFetch(200, exportResp);

    const result = await syncApi.exportData(TOKEN);

    expect(result).toHaveProperty("records");
    expect(Array.isArray(result.records)).toBe(true);
    expect(result).toHaveProperty("exportedAt");
    expect(typeof result.exportedAt).toBe("string");

    const record = result.records[0]!;
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("recordType");
    expect(record).toHaveProperty("encryptedPayload");
  });
});

describe("Request shape validation", () => {
  it("push sends correct Authorization header", async () => {
    mockFetch(200, { accepted: 0, conflicts: [], serverTimestamp: "2024-01-01T00:00:00Z" });

    await syncApi.push(TOKEN, {
      changes: [],
      deviceId: "device-1",
      lastPullTimestamp: "2024-01-01T00:00:00Z",
    });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const url = fetchCall[0] as string;
    const init = fetchCall[1] as RequestInit;
    const headers = new Headers(init.headers as HeadersInit);

    expect(url).toContain("/sync/push");
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.method).toBe("POST");

    // Validate request body shape matches PushRequest
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty("changes");
    expect(body).toHaveProperty("deviceId");
    expect(body).toHaveProperty("lastPullTimestamp");
  });

  it("pull sends since as query parameter", async () => {
    mockFetch(200, { changes: [], hasMore: false, serverTimestamp: "2024-01-01T00:00:00Z" });

    await syncApi.pull(TOKEN, "2024-06-01T00:00:00Z", "cursor-value", 50);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const url = fetchCall[0] as string;

    expect(url).toContain("since=2024-06-01T00%3A00%3A00Z");
    expect(url).toContain("cursor=cursor-value");
    expect(url).toContain("limit=50");
  });
});
