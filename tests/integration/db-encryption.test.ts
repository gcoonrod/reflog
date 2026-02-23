import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { createDB, type ReflogDB } from "@/db/schema";
import { encryptionMiddleware, setEncryptionKey } from "@/db/encryption";
import { generateSalt, deriveKey } from "@/services/crypto";
import type { Entry, VaultMeta } from "@/types";

let db: ReflogDB;
let key: CryptoKey;

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`);
  db.use(encryptionMiddleware);

  const salt = generateSalt();
  key = await deriveKey("test-passphrase", salt);
  setEncryptionKey(key);
});

afterEach(async () => {
  setEncryptionKey(null);
  await db.delete();
});

describe("DB encryption middleware", () => {
  it("encrypts entry fields on write and decrypts on read", async () => {
    const entry: Entry = {
      id: "e1",
      title: "My Title",
      body: "# Hello World",
      tags: ["test", "crypto"],
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncVersion: 0,
      deletedAt: null,
    };

    await db.entries.add(entry);

    // Read back via Dexie (should be decrypted)
    const result = await db.entries.get("e1");
    expect(result).toBeDefined();
    expect(result!.title).toBe("My Title");
    expect(result!.body).toBe("# Hello World");
    expect(result!.tags).toEqual(["test", "crypto"]);
    expect(result!.status).toBe("published");
  });

  it("stores ciphertext (not plaintext) in raw IndexedDB", async () => {
    const entry: Entry = {
      id: "e2",
      title: "Secret Title",
      body: "Secret body content",
      tags: ["secret"],
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncVersion: 0,
      deletedAt: null,
    };

    await db.entries.add(entry);

    // Read raw record bypassing middleware by opening a clean Dexie instance
    const { Dexie } = await import("dexie");
    const rawDb = new Dexie(db.name);
    rawDb.version(1).stores({
      vault_meta: "id",
      entries: "id, status, createdAt, updatedAt, [status+createdAt]",
      settings: "key",
    });

    const raw = (await rawDb.table("entries").get("e2")) as Record<
      string,
      unknown
    >;

    // The title field should be an encrypted object, not a plain string
    expect(raw.title).not.toBe("Secret Title");
    expect(typeof raw.title).toBe("object");
    expect(raw.title).toHaveProperty("ciphertext");
    expect(raw.title).toHaveProperty("iv");

    // Unencrypted fields should remain as-is
    expect(raw.status).toBe("published");
    expect(raw.id).toBe("e2");

    await rawDb.delete();
  });

  it("vault_meta table is NOT encrypted", async () => {
    const meta: VaultMeta = {
      id: "vault",
      salt: new Uint8Array([1, 2, 3]),
      verificationBlob: new Uint8Array([4, 5, 6]),
      iv: new Uint8Array([7, 8, 9]),
      createdAt: new Date().toISOString(),
    };

    await db.vault_meta.add(meta);
    const result = await db.vault_meta.get("vault");
    expect(result).toBeDefined();
    expect(result!.id).toBe("vault");
    expect(result!.createdAt).toBe(meta.createdAt);
  });

  it("encrypts settings value field", async () => {
    await db.settings.add({ key: "timeout", value: "300000" });

    const result = await db.settings.get("timeout");
    expect(result).toBeDefined();
    expect(result!.value).toBe("300000");
  });

  it("throws when writing without active key", async () => {
    setEncryptionKey(null);

    await expect(
      db.entries.add({
        id: "e3",
        title: "No Key",
        body: "Should fail",
        tags: [],
        status: "published",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncVersion: 0,
        deletedAt: null,
      }),
    ).rejects.toThrow("Vault is locked");
  });

  it("handles empty string fields", async () => {
    await db.entries.add({
      id: "e4",
      title: "",
      body: "",
      tags: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncVersion: 0,
      deletedAt: null,
    });

    const result = await db.entries.get("e4");
    expect(result!.title).toBe("");
    expect(result!.body).toBe("");
    expect(result!.tags).toEqual([]);
  });

  it("handles unicode content correctly", async () => {
    await db.entries.add({
      id: "e5",
      title: "日本語テスト",
      body: "Content with émojis 🚀",
      tags: ["日本語", "emoji-test"],
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncVersion: 0,
      deletedAt: null,
    });

    const result = await db.entries.get("e5");
    expect(result!.title).toBe("日本語テスト");
    expect(result!.body).toBe("Content with émojis 🚀");
    expect(result!.tags).toEqual(["日本語", "emoji-test"]);
  });

  it("query returns decrypted results", async () => {
    const now = new Date().toISOString();
    await db.entries.bulkAdd([
      {
        id: "q1",
        title: "First",
        body: "Body 1",
        tags: ["a"],
        status: "published" as const,
        createdAt: now,
        updatedAt: now,
        syncVersion: 0,
        deletedAt: null,
      },
      {
        id: "q2",
        title: "Second",
        body: "Body 2",
        tags: ["b"],
        status: "published" as const,
        createdAt: now,
        updatedAt: now,
        syncVersion: 0,
        deletedAt: null,
      },
    ]);

    const results = await db.entries
      .where("status")
      .equals("published")
      .toArray();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.title).sort()).toEqual(["First", "Second"]);
  });
});
