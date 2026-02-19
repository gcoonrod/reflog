import { describe, it, expect } from "vitest";
import {
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
} from "@/services/crypto";

describe("crypto", () => {
  it("generates a 16-byte salt", () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.byteLength).toBe(16);
  });

  it("generates unique salts", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toEqual(b);
  });

  it("derives a CryptoKey from passphrase and salt", async () => {
    const salt = generateSalt();
    const key = await deriveKey("test-passphrase", salt);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect(key.extractable).toBe(false);
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
  });

  it("encrypts and decrypts a string roundtrip", async () => {
    const salt = generateSalt();
    const key = await deriveKey("my-passphrase", salt);
    const plaintext = "Hello, encrypted world!";

    const { ciphertext, iv } = await encrypt(plaintext, key);
    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(iv).toBeInstanceOf(Uint8Array);
    expect(iv.byteLength).toBe(12);

    const decrypted = await decrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it("handles empty string encryption", async () => {
    const salt = generateSalt();
    const key = await deriveKey("passphrase", salt);

    const { ciphertext, iv } = await encrypt("", key);
    const decrypted = await decrypt(ciphertext, iv, key);
    expect(decrypted).toBe("");
  });

  it("handles unicode content", async () => {
    const salt = generateSalt();
    const key = await deriveKey("passphrase", salt);
    const plaintext = "日本語テスト 🚀 émojis";

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", async () => {
    const salt = generateSalt();
    const correctKey = await deriveKey("correct-passphrase", salt);
    const wrongKey = await deriveKey("wrong-passphrase", salt);

    const { ciphertext, iv } = await encrypt("secret data", correctKey);

    await expect(decrypt(ciphertext, iv, wrongKey)).rejects.toThrow();
  });

  it("same passphrase with different salts produces different keys", async () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    const keyA = await deriveKey("same-passphrase", saltA);
    const keyB = await deriveKey("same-passphrase", saltB);

    const { ciphertext, iv } = await encrypt("test", keyA);
    await expect(decrypt(ciphertext, iv, keyB)).rejects.toThrow();
  });
});
