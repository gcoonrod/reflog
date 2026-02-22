// T056: Unit tests for sync encryption pipeline (JSON → compress → encrypt → decrypt → decompress → JSON)

import { describe, it, expect } from "vitest";
import { encryptForSync, decryptFromSync } from "@/services/syncCrypto";

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

describe("syncCrypto", () => {
  it("encrypts and decrypts a simple object round-trip", async () => {
    const key = await makeKey();
    const original = { title: "Hello", body: "World", tags: ["test"] };

    const encrypted = await encryptForSync(original, key);
    expect(typeof encrypted).toBe("string");
    expect(encrypted.length).toBeGreaterThan(0);

    const decrypted = await decryptFromSync(encrypted, key);
    expect(decrypted).toEqual(original);
  });

  it("handles empty object", async () => {
    const key = await makeKey();
    const original = {};

    const encrypted = await encryptForSync(original, key);
    const decrypted = await decryptFromSync(encrypted, key);
    expect(decrypted).toEqual(original);
  });

  it("handles unicode and emoji content", async () => {
    const key = await makeKey();
    const original = {
      title: "日本語テスト",
      body: "Émojis 🚀 and ñ and ü",
    };

    const encrypted = await encryptForSync(original, key);
    const decrypted = await decryptFromSync(encrypted, key);
    expect(decrypted).toEqual(original);
  });

  it("handles large content (~100KB)", async () => {
    const key = await makeKey();
    const largeBody = "A".repeat(100_000);
    const original = { title: "Large entry", body: largeBody };

    const encrypted = await encryptForSync(original, key);
    const decrypted = await decryptFromSync(encrypted, key);
    expect(decrypted).toEqual(original);
  });

  it("produces different ciphertext for same input (random IV)", async () => {
    const key = await makeKey();
    const original = { data: "same content" };

    const a = await encryptForSync(original, key);
    const b = await encryptForSync(original, key);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const original = { secret: "data" };

    const encrypted = await encryptForSync(original, key1);
    await expect(decryptFromSync(encrypted, key2)).rejects.toThrow();
  });

  it("achieves compression on text-heavy content", async () => {
    const key = await makeKey();
    const repetitiveText = "The quick brown fox jumps over the lazy dog. ".repeat(
      500,
    );
    const original = { body: repetitiveText };

    const encrypted = await encryptForSync(original, key);
    const jsonLength = JSON.stringify(original).length;

    // Base64 of compressed+encrypted should be smaller than raw JSON for repetitive content
    expect(encrypted.length).toBeLessThan(jsonLength);
  });
});
