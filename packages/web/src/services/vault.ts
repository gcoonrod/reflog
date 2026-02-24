import db, { setEncryptionKey } from "@/db";
import { generateSalt, deriveKey, encrypt, decrypt } from "@/services/crypto";
import * as search from "@/services/search";
import { nowISO } from "@/utils/date";
import type { VaultMeta } from "@/types";

const SENTINEL = "reflog-vault-check";

let cryptoKey: CryptoKey | null = null;

export async function isSetUp(): Promise<boolean> {
  const meta = await db.vault_meta.get("vault");
  return meta !== undefined;
}

export async function setup(passphrase: string): Promise<CryptoKey> {
  const salt = generateSalt();
  const key = await deriveKey(passphrase, salt);

  const { ciphertext: verificationBlob, iv } = await encrypt(SENTINEL, key);

  const meta: VaultMeta = {
    id: "vault",
    salt,
    verificationBlob,
    iv,
    createdAt: nowISO(),
  };

  await db.vault_meta.put(meta);

  cryptoKey = key;
  setEncryptionKey(key);

  // Build search index (empty for new vault)
  search.buildIndex([]);

  return key;
}

export async function unlock(passphrase: string): Promise<CryptoKey> {
  const meta = await db.vault_meta.get("vault");
  if (!meta) {
    throw new Error("Vault has not been set up");
  }

  const key = await deriveKey(passphrase, meta.salt);

  try {
    const result = await decrypt(meta.verificationBlob, meta.iv, key);
    if (result !== SENTINEL) {
      throw new Error("Incorrect passphrase");
    }
  } catch {
    throw new Error("Incorrect passphrase");
  }

  cryptoKey = key;
  setEncryptionKey(key);

  // Build search index from all published entries
  const entries = await db.entries
    .where("status")
    .equals("published")
    .toArray();
  search.buildIndex(entries);

  return key;
}

export function lock(): void {
  cryptoKey = null;
  setEncryptionKey(null);
  search.clearIndex();
}

export function isUnlocked(): boolean {
  return cryptoKey !== null;
}
