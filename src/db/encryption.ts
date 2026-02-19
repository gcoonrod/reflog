import Dexie from "dexie";
import type { DBCore, DBCoreTable, Middleware } from "dexie";
import { encrypt, decrypt } from "@/services/crypto";
import type { EncryptedField } from "@/types";

/** Tables and their fields that require encryption/decryption. */
const ENCRYPTED_TABLES: Record<string, string[]> = {
  entries: ["title", "body", "tags"],
  settings: ["value"],
};

/** Shared mutable reference to the current CryptoKey. */
let activeKey: CryptoKey | null = null;

export function setEncryptionKey(key: CryptoKey | null): void {
  activeKey = key;
}

export function getEncryptionKey(): CryptoKey | null {
  return activeKey;
}

function getEncryptedFields(tableName: string): string[] | undefined {
  return ENCRYPTED_TABLES[tableName];
}

async function encryptRecord(
  record: Record<string, unknown>,
  fields: string[],
  key: CryptoKey,
): Promise<Record<string, unknown>> {
  const clone = { ...record };
  for (const field of fields) {
    const value = clone[field];
    if (value !== undefined && value !== null) {
      // Always JSON.stringify to preserve type information on roundtrip
      const serialized = JSON.stringify(value);
      const { ciphertext, iv } = await encrypt(serialized, key);
      clone[field] = { ciphertext, iv } satisfies EncryptedField;
    }
  }
  return clone;
}

async function decryptRecord<T>(
  record: T | undefined,
  fields: string[],
  key: CryptoKey,
): Promise<T | undefined> {
  if (!record) return record;
  const clone = { ...(record as Record<string, unknown>) };
  for (const field of fields) {
    const value = clone[field] as EncryptedField | undefined;
    if (
      value &&
      typeof value === "object" &&
      "ciphertext" in value &&
      "iv" in value
    ) {
      const plaintext = await decrypt(value.ciphertext, value.iv, key);
      clone[field] = JSON.parse(plaintext) as unknown;
    }
  }
  return clone as T;
}

function createEncryptedTable(
  downlevelTable: DBCoreTable,
  fields: string[],
): DBCoreTable {
  return {
    ...downlevelTable,

    mutate(req) {
      if (!activeKey) {
        return Dexie.Promise.reject(
          new Error("Vault is locked — cannot write encrypted data"),
        );
      }
      if ("values" in req) {
        const key = activeKey;
        const values = req.values as Record<string, unknown>[];
        return Dexie.waitFor(
          Promise.all(values.map((v) => encryptRecord(v, fields, key))),
        ).then((encrypted) =>
          downlevelTable.mutate({
            ...req,
            values: encrypted,
          } as typeof req),
        );
      }
      return downlevelTable.mutate(req);
    },

    get(req) {
      return downlevelTable.get(req).then((result) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        if (!activeKey || !result) return result;
        return Dexie.waitFor(decryptRecord(result, fields, activeKey));
      });
    },

    getMany(req) {
      return downlevelTable.getMany(req).then((results) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        if (!activeKey) return results;
        const key = activeKey;
        return Dexie.waitFor(
          Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            results.map((r) => (r ? decryptRecord(r, fields, key) : r)),
          ),
        );
      });
    },

    query(req) {
      return downlevelTable.query(req).then((response) => {
        if (!activeKey) return response;
        const key = activeKey;
        return Dexie.waitFor(
          Promise.all(
            response.result.map((r: unknown) =>
              decryptRecord(r as Record<string, unknown>, fields, key),
            ),
          ),
        ).then((decryptedResult) => ({
          ...response,
          result: decryptedResult,
        }));
      });
    },

  };
}

export const encryptionMiddleware: Middleware<DBCore> = {
  stack: "dbcore",
  name: "EncryptionMiddleware",
  create(downlevelDatabase) {
    return {
      ...downlevelDatabase,
      table(tableName: string) {
        const downlevelTable = downlevelDatabase.table(tableName);
        const fields = getEncryptedFields(tableName);
        if (!fields) return downlevelTable;
        return createEncryptedTable(downlevelTable, fields);
      },
    };
  },
};
