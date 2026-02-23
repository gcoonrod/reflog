import { describe, it, expect } from "vitest";
import { toUint8Array, unwrapLegacyEncryptedFields } from "@/services/sync";
import { encrypt } from "@/services/crypto";

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Simulate the JSON round-trip that Uint8Arrays go through when stored
 * in sync_queue: JSON.stringify converts Uint8Array to {"0":n,"1":n,...},
 * and JSON.parse converts it back to a plain object with string keys.
 */
function jsonRoundTrip(arr: Uint8Array): Record<string, number> {
  return JSON.parse(JSON.stringify(arr)) as Record<string, number>;
}

describe("toUint8Array", () => {
  it("reconstructs a Uint8Array from a JSON-round-tripped plain object", () => {
    const original = new Uint8Array([10, 20, 30, 40, 50]);
    const roundTripped = jsonRoundTrip(original);

    const result = toUint8Array(roundTripped);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(original);
  });

  it("handles a single-byte array", () => {
    const result = toUint8Array({ "0": 255 });
    expect(result).toEqual(new Uint8Array([255]));
  });

  it("handles a large array (256 bytes)", () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;
    const roundTripped = jsonRoundTrip(original);

    const result = toUint8Array(roundTripped);
    expect(result).toEqual(original);
  });

  it("derives length from max key + 1, not key count", () => {
    // Sparse object: keys 0 and 4 present, 1-3 missing
    const sparse = { "0": 65, "4": 90 };
    const result = toUint8Array(sparse);

    expect(result.length).toBe(5);
    expect(result[0]).toBe(65);
    expect(result[1]).toBe(0); // missing → default 0
    expect(result[4]).toBe(90);
  });

  it("ignores non-numeric keys", () => {
    const obj = { "0": 10, "1": 20, notANumber: 99 } as unknown as Record<
      string,
      number
    >;
    const result = toUint8Array(obj);

    expect(result).toEqual(new Uint8Array([10, 20]));
  });

  it("ignores negative keys", () => {
    const obj = { "-1": 5, "0": 10, "1": 20 };
    const result = toUint8Array(obj);

    expect(result).toEqual(new Uint8Array([10, 20]));
  });

  it("throws on an empty object with no valid byte indices", () => {
    expect(() => toUint8Array({})).toThrow(
      "Legacy encrypted field has no valid byte indices",
    );
  });

  it("throws on an object with only non-numeric keys", () => {
    const obj = { foo: 1, bar: 2 } as unknown as Record<string, number>;
    expect(() => toUint8Array(obj)).toThrow(
      "Legacy encrypted field has no valid byte indices",
    );
  });
});

describe("unwrapLegacyEncryptedFields", () => {
  it("decrypts fields that have JSON-round-tripped {ciphertext, iv}", async () => {
    const key = await makeKey();

    // Encrypt a title field the way the old middleware would have
    const { ciphertext, iv } = await encrypt(JSON.stringify("Hello World"), key);
    // Simulate JSON round-trip (Uint8Array → plain object)
    const legacyRecord = {
      id: "entry-1",
      title: JSON.parse(JSON.stringify({ ciphertext, iv })) as unknown,
      body: JSON.parse(JSON.stringify(await encrypt(JSON.stringify("Body text"), key))) as unknown,
      tags: JSON.parse(JSON.stringify(await encrypt(JSON.stringify(["tag1", "tag2"]), key))) as unknown,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      status: "published",
    };

    const result = await unwrapLegacyEncryptedFields(
      legacyRecord as Record<string, unknown>,
      key,
    );

    expect(result.id).toBe("entry-1");
    expect(result.title).toBe("Hello World");
    expect(result.body).toBe("Body text");
    expect(result.tags).toEqual(["tag1", "tag2"]);
    // Non-encrypted fields pass through unchanged
    expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(result.status).toBe("published");
  });

  it("passes through plaintext fields without modification", async () => {
    const key = await makeKey();
    const plaintextRecord = {
      id: "entry-2",
      title: "Already plaintext",
      body: "No encryption here",
      tags: ["a", "b"],
      createdAt: "2026-01-01T00:00:00Z",
    };

    const result = await unwrapLegacyEncryptedFields(plaintextRecord, key);

    expect(result).toEqual(plaintextRecord);
  });

  it("handles a mix of encrypted and plaintext fields", async () => {
    const key = await makeKey();
    const { ciphertext, iv } = await encrypt(JSON.stringify("Encrypted title"), key);

    const mixedRecord = {
      id: "entry-3",
      title: JSON.parse(JSON.stringify({ ciphertext, iv })) as unknown,
      body: "Plaintext body",
      createdAt: "2026-01-01T00:00:00Z",
    };

    const result = await unwrapLegacyEncryptedFields(
      mixedRecord as Record<string, unknown>,
      key,
    );

    expect(result.title).toBe("Encrypted title");
    expect(result.body).toBe("Plaintext body");
  });

  it("does not modify arrays even if they contain objects", async () => {
    const key = await makeKey();
    const record = {
      tags: ["tag1", "tag2"],
      nested: [{ ciphertext: "not real", iv: "not real" }],
    };

    const result = await unwrapLegacyEncryptedFields(record, key);

    expect(result.tags).toEqual(["tag1", "tag2"]);
    expect(result.nested).toEqual([
      { ciphertext: "not real", iv: "not real" },
    ]);
  });

  it("skips fields where ciphertext or iv is falsy", async () => {
    const key = await makeKey();
    const record = {
      broken: { ciphertext: null, iv: null },
      id: "entry-4",
    };

    const result = await unwrapLegacyEncryptedFields(
      record as unknown as Record<string, unknown>,
      key,
    );

    // broken field is unchanged (skipped due to null ciphertext/iv)
    expect(result.broken).toEqual({ ciphertext: null, iv: null });
  });
});
