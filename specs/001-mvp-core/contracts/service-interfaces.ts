/**
 * Service Interface Contracts: Reflog MVP Core
 *
 * These interfaces define the service layer that UI components consume.
 * This is a client-only app — no REST API endpoints exist.
 * All operations run locally against encrypted IndexedDB via Dexie v4
 * DBCore middleware (db.use()) for transparent field-level encryption.
 *
 * Branch: 001-mvp-core | Date: 2026-02-19 | Updated: 2026-02-19
 */

// ─── Entity Types ─────────────────────────────────────────────

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

// ─── Vault Service ────────────────────────────────────────────

export interface VaultService {
  /** Check if a vault has been set up on this device. */
  isSetUp(): Promise<boolean>;

  /**
   * Create a new vault with the given passphrase.
   * Derives encryption key, stores salt and verification blob.
   * Returns the derived CryptoKey held in memory.
   */
  setup(passphrase: string): Promise<CryptoKey>;

  /**
   * Unlock the vault by verifying the passphrase.
   * Returns the derived CryptoKey if correct, throws if incorrect.
   */
  unlock(passphrase: string): Promise<CryptoKey>;

  /**
   * Lock the vault: clear the CryptoKey and all decrypted data
   * from memory. Destroy the search index.
   */
  lock(): void;

  /** Check if the vault is currently unlocked. */
  isUnlocked(): boolean;
}

// ─── Entry Service ────────────────────────────────────────────

export interface CreateEntryInput {
  title?: string; // Defaults to current date/time
  body: string;
  tags?: string[];
}

export interface UpdateEntryInput {
  title?: string;
  body?: string;
  tags?: string[];
}

export interface EntryService {
  /**
   * Create and publish a new entry.
   * Encrypts title, body, and tags before storing.
   * Updates the in-memory search index.
   */
  create(input: CreateEntryInput): Promise<Entry>;

  /**
   * Get a single entry by ID.
   * Returns decrypted entry or null if not found.
   */
  getById(id: string): Promise<Entry | null>;

  /**
   * List published entries in reverse-chronological order.
   * Supports optional tag filtering.
   * Returns decrypted entries.
   */
  list(options?: {
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Entry[]>;

  /**
   * Update an existing entry.
   * Re-encrypts changed fields. Updates search index.
   */
  update(id: string, input: UpdateEntryInput): Promise<Entry>;

  /**
   * Permanently delete an entry.
   * Removes from IndexedDB and search index.
   */
  delete(id: string): Promise<void>;

  /**
   * Save current editor content as a draft.
   * If entryId is provided, saves as draft of existing entry.
   * Otherwise saves as a new draft.
   */
  saveDraft(input: CreateEntryInput, entryId?: string): Promise<Entry>;

  /**
   * Get the current draft, if one exists.
   * Returns null if no draft is saved.
   */
  getDraft(entryId?: string): Promise<Entry | null>;

  /**
   * Publish a draft entry to the timeline.
   * Changes status from "draft" to "published".
   */
  publishDraft(draftId: string): Promise<Entry>;

  /**
   * Discard a draft without publishing.
   */
  discardDraft(draftId: string): Promise<void>;
}

// ─── Search Service ───────────────────────────────────────────

export interface SearchResult {
  entryId: string;
  title: string;
  /** Snippet of matching content with match highlighted. */
  snippet: string;
  score: number;
  createdAt: string;
  tags: string[];
}

export interface SearchService {
  /**
   * Build the in-memory search index from all decrypted entries.
   * Called once on vault unlock.
   */
  buildIndex(entries: Entry[]): void;

  /**
   * Search entries by query string.
   * Returns results ranked by relevance.
   */
  search(query: string): SearchResult[];

  /**
   * Add a single entry to the index (after create).
   */
  addToIndex(entry: Entry): void;

  /**
   * Update a single entry in the index (after edit).
   */
  updateInIndex(entry: Entry): void;

  /**
   * Remove a single entry from the index (after delete).
   */
  removeFromIndex(entryId: string): void;

  /**
   * Destroy the search index and free memory.
   * Called on vault lock.
   */
  clearIndex(): void;
}

// ─── Tag Service ──────────────────────────────────────────────

export interface TagWithCount {
  name: string;
  count: number;
}

export interface TagService {
  /**
   * Extract tags from Markdown body content.
   * Finds all #tag-name patterns and normalizes them.
   */
  extractFromBody(body: string): string[];

  /**
   * Normalize a raw tag string to canonical form.
   * e.g., "Bug Hunt" → "bug-hunt"
   */
  normalize(raw: string): string;

  /**
   * Merge tags from body extraction and explicit tag input.
   * Deduplicates and normalizes.
   */
  mergeTags(bodyTags: string[], explicitTags: string[]): string[];

  /**
   * Get all unique tags across all published entries with counts.
   * Sorted by count descending.
   */
  getAllWithCounts(): Promise<TagWithCount[]>;
}

// ─── Keyboard Service ─────────────────────────────────────────

export interface KeyboardShortcut {
  /** e.g., "mod+n", "mod+enter", "mod+k", "escape" */
  keys: string;
  /** Callback invoked when shortcut is triggered. */
  handler: () => void;
  /** If true, preventDefault on the event. Default: true. */
  preventDefault?: boolean;
  /** Description shown in help UI. */
  description: string;
}

export interface KeyboardService {
  /**
   * Register a global keyboard shortcut.
   * "mod" maps to Cmd on macOS, Ctrl on Windows/Linux.
   */
  register(shortcut: KeyboardShortcut): () => void;

  /**
   * Unregister all shortcuts. Called on vault lock.
   */
  unregisterAll(): void;
}

// ─── Auto-Lock Service ────────────────────────────────────────

export interface AutoLockService {
  /**
   * Start monitoring for inactivity and visibility changes.
   * Calls onLock when either condition triggers.
   */
  start(onLock: () => void): void;

  /**
   * Reset the inactivity timer (called on user interaction).
   */
  resetTimer(): void;

  /**
   * Stop monitoring. Called on vault lock or app teardown.
   */
  stop(): void;
}

// ─── Crypto Utilities ─────────────────────────────────────────

export interface CryptoUtils {
  /**
   * Derive an AES-256-GCM key from a passphrase and salt.
   */
  deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey>;

  /**
   * Generate a random salt (16 bytes).
   */
  generateSalt(): Uint8Array;

  /**
   * Encrypt a string with AES-256-GCM.
   * Returns ciphertext and IV.
   */
  encrypt(
    plaintext: string,
    key: CryptoKey
  ): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }>;

  /**
   * Decrypt ciphertext with AES-256-GCM.
   * Returns plaintext string.
   */
  decrypt(
    ciphertext: Uint8Array,
    iv: Uint8Array,
    key: CryptoKey
  ): Promise<string>;
}
