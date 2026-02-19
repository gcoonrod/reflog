import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import * as vault from "@/services/vault";
import { setEncryptionKey } from "@/db/encryption";

// The vault service uses the default db instance from @/db.
// We need to reset state between tests.

beforeEach(() => {
  vault.lock();
});

afterEach(async () => {
  vault.lock();
  // Clear the vault_meta table via the default db
  const { default: db } = await import("@/db");
  await db.vault_meta.clear();
});

describe("vault service", () => {
  it("isSetUp returns false when no vault exists", async () => {
    expect(await vault.isSetUp()).toBe(false);
  });

  it("setup creates vault_meta and unlocks", async () => {
    const key = await vault.setup("my-passphrase");
    expect(key).toBeInstanceOf(CryptoKey);
    expect(vault.isUnlocked()).toBe(true);
    expect(await vault.isSetUp()).toBe(true);
  });

  it("correct passphrase unlocks the vault", async () => {
    await vault.setup("correct-pass");
    vault.lock();
    expect(vault.isUnlocked()).toBe(false);

    const key = await vault.unlock("correct-pass");
    expect(key).toBeInstanceOf(CryptoKey);
    expect(vault.isUnlocked()).toBe(true);
  });

  it("wrong passphrase throws on unlock", async () => {
    await vault.setup("correct-pass");
    vault.lock();

    await expect(vault.unlock("wrong-pass")).rejects.toThrow(
      "Incorrect passphrase",
    );
    expect(vault.isUnlocked()).toBe(false);
  });

  it("lock nullifies the key", async () => {
    await vault.setup("passphrase");
    expect(vault.isUnlocked()).toBe(true);

    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
  });

  it("unlock throws when vault is not set up", async () => {
    await expect(vault.unlock("anything")).rejects.toThrow(
      "Vault has not been set up",
    );
  });
});
