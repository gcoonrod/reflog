// Entity Types

export interface Entry {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: "draft" | "published";
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface VaultMeta {
  id: "vault";
  salt: Uint8Array;
  verificationBlob: Uint8Array;
  iv: Uint8Array;
  createdAt: string; // ISO 8601
}

export interface Setting {
  key: string;
  value: string;
}

// Input Types

export interface CreateEntryInput {
  title?: string;
  body: string;
  tags?: string[];
}

export interface UpdateEntryInput {
  title?: string;
  body?: string;
  tags?: string[];
}

// Result Types

export interface SearchResult {
  entryId: string;
  title: string;
  snippet: string;
  score: number;
  createdAt: string;
  tags: string[];
}

export interface TagWithCount {
  name: string;
  count: number;
}

export interface KeyboardShortcut {
  keys: string;
  handler: () => void;
  preventDefault?: boolean;
  description: string;
}

// Encrypted Field Shape (stored in IndexedDB)

export interface EncryptedField {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}
