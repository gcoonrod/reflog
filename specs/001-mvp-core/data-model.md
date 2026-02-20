# Data Model: Reflog MVP Core

**Branch**: `001-mvp-core` | **Date**: 2026-02-19

## Storage Engine

IndexedDB via Dexie.js v4. Encrypted fields use AES-256-GCM via Web Crypto
API with PBKDF2 key derivation from user passphrase.

## Tables

### `vault_meta` (unencrypted)

Stores vault configuration needed before decryption is possible.

| Field | Type | Indexed | Encrypted | Description |
|-------|------|---------|-----------|-------------|
| `id` | string | PK | No | Always `"vault"` (singleton) |
| `salt` | Uint8Array | No | No | PBKDF2 salt (random, 16 bytes) |
| `verificationBlob` | Uint8Array | No | No | Encrypted known sentinel for passphrase verification |
| `iv` | Uint8Array | No | No | IV used for verification blob encryption |
| `createdAt` | string (ISO) | No | No | Vault creation timestamp |

### `entries`

| Field | Type | Indexed | Encrypted | Description |
|-------|------|---------|-----------|-------------|
| `id` | string (UUID) | PK | No | Unique entry identifier |
| `title` | string | No | **Yes** | Entry title (defaults to date/time) |
| `body` | string | No | **Yes** | Raw Markdown content |
| `tags` | string[] | No | **Yes** | Array of normalized tag names |
| `status` | `"draft"` \| `"published"` | Yes | No | Entry lifecycle state |
| `createdAt` | string (ISO) | Yes | No | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | No | Last modification timestamp |

**Indexes**: `id` (PK), `status`, `createdAt`, `updatedAt`,
`[status+createdAt]` (compound — for "published entries, newest first").

### `settings`

| Field | Type | Indexed | Encrypted | Description |
|-------|------|---------|-----------|-------------|
| `key` | string | PK | No | Setting identifier |
| `value` | string | No | **Yes** | Setting value (encrypted) |

Reserved keys: `inactivityTimeoutMs` (default: 300000).

## Entity Relationships

```text
VaultMeta (singleton)
  └── provides salt + verification for key derivation

Entry (many)
  ├── has many Tags (embedded as string[])
  └── has status: draft | published

Settings (few)
  └── key-value pairs for app configuration
```

## State Transitions

### Entry Lifecycle

```text
[New] ──save──► [Published]
  │                 │
  │              [Edit] ──save──► [Published] (updated)
  │                 │
  │              [Delete] ──confirm──► [Removed]
  │
[Draft] ──auto-save──► [Draft] (updated)
  │
  └── explicit save ──► [Published]
```

- **Draft**: Created by auto-save on navigate-away or auto-lock. Not
  visible in timeline. One draft per entry (new or existing).
- **Published**: Visible in timeline, searchable, taggable.
- **Removed**: Permanently deleted from IndexedDB. No soft-delete.

### Vault Lifecycle

```text
[No Vault] ──setup──► [Locked] ──unlock──► [Unlocked]
                          ▲                     │
                          └── auto-lock ◄───────┘
                          └── visibility-loss ◄─┘
```

## Tag Normalization Rules

1. Strip leading `#` if present
2. Convert to lowercase
3. Replace spaces and underscores with hyphens
4. Remove characters not matching `[a-z0-9-]`
5. Collapse consecutive hyphens
6. Trim leading/trailing hyphens

Examples:
- `#Bug Hunt` → `bug-hunt`
- `Architecture` → `architecture`
- `React_Components` → `react-components`
- `C++` → `c`

## Encryption Architecture

### Key Derivation

```text
passphrase (string)
  → TextEncoder.encode()
  → crypto.subtle.importKey("raw", ..., "PBKDF2")
  → crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      ...,
      { name: "AES-GCM", length: 256 }
    )
  → CryptoKey (non-extractable)
```

### Field Encryption (via DBCore middleware)

Encryption is transparent to application code. The Dexie DBCore middleware
(`db.use()`) intercepts all `mutate()` (write) and `get()`/`getMany()`/
`query()` (read) operations, encrypting/decrypting the `title`, `body`, and
`tags` fields automatically.

```text
plaintext (string)
  → TextEncoder.encode()
  → crypto.subtle.encrypt(
      { name: "AES-GCM", iv: randomIV(12) },
      derivedKey,
      encoded
    )
  → { ciphertext: Uint8Array, iv: Uint8Array }
```

### Passphrase Verification

```text
On setup:
  encrypt("reflog-vault-check") → store as verificationBlob + iv

On unlock:
  decrypt(verificationBlob, iv) → if result === "reflog-vault-check" → OK
  else → wrong passphrase
```

## In-Memory Search Index

Built on vault unlock, destroyed on vault lock.

**Indexed fields**: `title`, `body` (both decrypted plaintext)
**Stored fields**: `id`, `title`, `createdAt`, `tags`
**Search options**: prefix matching, fuzzy tolerance 1, boost `title` 2x

Index is rebuilt from scratch on unlock. Incremental updates via
`add()`, `replace()`, `remove()` on entry CRUD operations.
