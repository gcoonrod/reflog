# Quickstart: Authentication & Cross-Device Sync

**Feature**: 004-auth-and-sync | **Date**: 2026-02-21

## Prerequisites

### Auth0 Setup (One-Time)

1. Create an Auth0 account at [auth0.com](https://auth0.com).
2. Create a new **Single Page Application** in the Auth0 Dashboard.
3. Configure application settings:
   - **Allowed Callback URLs**: `http://localhost:3000, https://reflog.microcode.io`
   - **Allowed Logout URLs**: `http://localhost:3000, https://reflog.microcode.io`
   - **Allowed Web Origins**: `http://localhost:3000, https://reflog.microcode.io`
   - **Token Endpoint Authentication Method**: None
   - **JsonWebToken Signature Algorithm**: RS256
   - **Grant Types**: Authorization Code
4. Enable **Refresh Token Rotation** in Application Settings > Refresh Token.
5. Enable social connections in Auth0 Dashboard > Authentication > Social:
   - **GitHub**: Create a GitHub OAuth App, enter Client ID and Client Secret in Auth0.
   - **Google**: Create a Google OAuth 2.0 credential, enter Client ID and Client Secret in Auth0.
   - Ensure both connections are enabled for the SPA application created in step 2.
6. Enable **Attack Protection** in Security > Attack Protection:
   - Brute-Force Protection: ON (10 attempts, 15-minute lockout)
   - Suspicious IP Throttling: ON
   - Breached Password Detection: ON
7. Create an **API** in Auth0 Dashboard > APIs:
   - **Identifier (Audience)**: `https://sync.reflog.microcode.io`
   - **Signing Algorithm**: RS256
8. Note the following values for environment variables:
   - Auth0 Domain (e.g., `reflog.us.auth0.com`)
   - Client ID
   - API Audience

### Cloudflare Workers Setup (One-Time)

1. Ensure Cloudflare account exists (from 003-cd-pipeline).
2. Subscribe to Workers Paid plan ($5/month) in Cloudflare Dashboard.
3. Create D1 database:
   ```bash
   npx wrangler d1 create reflog-sync
   ```
4. Note the database ID from the output for `wrangler.toml`.
5. The Worker is accessed via its `workers.dev` URL (e.g., `https://reflog-sync-api.<account>.workers.dev`). No custom domain or DNS changes are needed — the primary domain (`microcode.io`) stays on Route 53/AWS.

### Environment Variables

#### Client (PWA) — `.env.local`
```env
VITE_AUTH0_DOMAIN=<your-auth0-tenant>.us.auth0.com
VITE_AUTH0_CLIENT_ID=<client-id>
VITE_AUTH0_AUDIENCE=https://sync.reflog.microcode.io
# Sync API uses workers.dev URL (no custom domain — Route 53 stays on AWS)
VITE_SYNC_API_URL=https://<your-worker-name>.<account>.workers.dev/api/v1
```

#### Worker — Secrets
```bash
# Set secrets (not stored in wrangler.toml)
npx wrangler secret put AUTH0_DOMAIN
npx wrangler secret put AUTH0_AUDIENCE
```

### Complete wrangler.toml Reference

This is the final shape of `workers/sync-api/wrangler.toml` after all tasks are complete (T001 creates it, T044 adds rate limiting, T047 adds cron trigger):

```toml
name = "reflog-sync-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
AUTH0_DOMAIN = "<your-auth0-tenant>.us.auth0.com"
AUTH0_AUDIENCE = "https://sync.reflog.microcode.io"

[[d1_databases]]
binding = "DB"
database_name = "reflog-sync"
database_id = "<database-id>"

# Rate limiting (T044) — built-in Cloudflare Rate Limiting binding
# See research.md R2 § Rate Limiting for binding API usage
[[ratelimits]]
name = "RATE_LIMITER_IP"
namespace_id = "1001"

  [ratelimits.simple]
  limit = 100
  period = 60

[[ratelimits]]
name = "RATE_LIMITER_USER"
namespace_id = "1002"

  [ratelimits.simple]
  limit = 200
  period = 60

# Tombstone GC cron (T047) — daily at 3 AM UTC
[triggers]
crons = ["0 3 * * *"]
```

**Note**: The `[[ratelimits]]` syntax requires wrangler v4.36.0+. Usage in Worker code: `const { success } = await env.RATE_LIMITER_USER.limit({ key: userId })`.

---

## Implementation Sequence

Phases are numbered to match [tasks.md](./tasks.md) for cross-reference.

### Phase 1: Setup (tasks.md T001–T004)
1. Scaffold Worker project at `workers/sync-api/` (T001).
2. Install `@auth0/auth0-react` in PWA (T002).
3. Create shared sync type definitions (T003).
4. Create `.env.example` (T004).

### Phase 2: Foundational (tasks.md T005–T014)
1. **MANUAL**: Auth0 account + social connections + Attack Protection (T005).
2. **MANUAL**: Cloudflare Workers Paid + D1 database + DNS (T006).
3. D1 schema migration (T007).
4. Hono app entry point with route groups (T008).
5. JWT verification middleware (T009).
6. CORS middleware (T010).
7. Health endpoint (T011).
8. D1 query builders (T012).
9. Dexie v2 migration — sync_queue, sync_meta tables (T013).
10. TypeScript interface updates — Entry + sync fields (T014).

### Phase 3: US1 — Authentication / P1 MVP (tasks.md T015–T023)
1. Auth0Provider in `__root.tsx` (T015).
2. `useAuth` hook (T016).
3. Login route (T017).
4. AuthGuard component (T018).
5. Route gating (T019).
6. Vault state machine integration (T020).
7. Server-side user middleware (T021).
8. Device registration endpoint (T022).
9. Client-side device registration (T023).

### Phase 4: US3 — Session Management / P2 (tasks.md T024–T028)
1. AccountMenu component (T024).
2. Lock button in header (T025).
3. Shift+Meta+L shortcut (T026).
4. Logout flow with keep/clear dialog (T027).
5. Auto-lock compatibility verification (T028).

### Phase 5: US2 — Cross-Device Sync / P2 (tasks.md T029–T043)

**Server-side:**
1. Sync push endpoint (T029).
2. Sync pull endpoint (T030).
3. Account endpoints — usage, delete, export (T031).
4. Device last-seen tracking (T032).

**Client-side:**
5. DBCore middleware for change tracking (T033).
6. Sync API HTTP client (T034).
7. Sync engine — push, pull, conflict resolution (T035).
8. Sync scheduler — triggers (T036).
9. Cross-tab sync coordinator (T037).
10. Initial device setup — full pull (T038).
11. `useSyncStatus` hook (T039).
12. SyncIndicator component (T040).
13. SyncIndicator in header (T041).
14. Conflict notification (T042).
15. Sync lifecycle initialization (T043).

### Phase 6: US4 — Abuse Protection / P3 (tasks.md T044–T047)
1. Rate limiting middleware — built-in binding (T044).
2. Request validation middleware (T045).
3. ~~Auth0 bot detection (T046)~~ — **DESCOPED** (requires Enterprise subscription).
4. Tombstone GC cron (T047).

### Phase 7: Migration & Polish (tasks.md T048–T053b)
1. Migration route for existing MVP users (T048).
2. Migration detection in vault hook (T049).
3. Account deletion client flow (T050).
4. Data export client flow (T051).
5. CI workflow update for Worker (T052).
6. Root layout final integration (T053).
7. Auth error boundary — catches Auth0 failures, recovery UI (T053a).
8. Sync error boundary — catches sync failures, graceful offline degradation (T053b).

### Phase 8: Testing & Verification (tasks.md T054–T063, T060a)
1. Unit tests — sync engine, middleware, encryption (T054–T056).
2. Contract tests — API schema validation (T057).
3. Integration tests — Miniflare Worker endpoints (T058).
4. E2E tests — auth and sync flows (T059–T060).
5. Performance validation — SC-005 sync < 2s, SC-006 rejection < 100ms, SC-008 lock/logout < 2s (T060a).
6. Quality gate (T061).
7. Production deploy (T062).
8. Production verification (T063).

---

## Architecture Decision Notes

These notes cover implementation decisions that span multiple tasks. Individual tasks reference them as `quickstart.md § A1`, `quickstart.md § A2`, etc.

### A1: Dexie Middleware Ordering (T013, T033)

The existing `src/db/encryption.ts` is a Dexie DBCore middleware that transparently encrypts fields (`title`, `body`, `tags` on entries; `value` on settings) for local IndexedDB storage. The new `src/db/middleware.ts` (sync tracking) will intercept mutations to write `sync_queue` records.

**Registration order matters.** Dexie stacks middlewares so the **last** registered via `db.use()` becomes the **outermost** layer (closest to application code). The encryption middleware must be registered **first** (inner, closest to IndexedDB) and the sync middleware **second** (outer, closest to the app) so it captures **plaintext** records for the sync payload:

```
App write → Sync Middleware (captures plaintext for sync_queue.payload)
          → Encryption Middleware (encrypts fields for IndexedDB)
          → IndexedDB

App read  → IndexedDB → Encryption Middleware (decrypts) → App
```

In `src/db/index.ts`, register middleware in this order:
```typescript
db.use(encryptionMiddleware);  // Inner (first): encrypts for storage
db.use(syncMiddleware);        // Outer (second): sees plaintext
```

The `sync_queue.payload` field stores a **plaintext JSON snapshot** of the record. This is safe because `sync_queue` is local-only (never leaves the device). The sync engine separately encrypts this payload for transport using the sync encryption pipeline (see § A3).

### A2: The `isSyncing` Flag (T033, T035, T043)

When the sync engine pulls remote records and writes them to the local database, the DBCore sync middleware would normally capture these writes as new changes and add them to `sync_queue` — creating an infinite sync loop.

**Implementation:**

```typescript
// src/db/middleware.ts
let _isSyncing = false;

export function setSyncing(value: boolean): void {
  _isSyncing = value;
}

// Inside the middleware mutate handler:
if (_isSyncing) return next(req); // Skip sync_queue write
```

The sync engine (T035) wraps pull-apply operations:

```typescript
// src/services/sync.ts
import { setSyncing } from "../db/middleware";

async function applyPulledRecords(records: DecryptedRecord[]): Promise<void> {
  setSyncing(true);
  try {
    for (const record of records) {
      await db.entries.put(record); // Middleware skips sync_queue
    }
  } finally {
    setSyncing(false);
  }
}
```

This is a module-level boolean (not per-tab or per-async-context) because Dexie operations are single-threaded within a tab. The Web Locks coordinator (T037) ensures only one tab runs sync at a time.

### A3: Sync Encryption Pipeline (T035, T056)

The sync engine needs a different encryption path than the local Dexie middleware. Local storage encrypts individual **fields**; sync transport encrypts the **entire record** as a blob.

**Pipeline:**
```
Encrypt: JSON.stringify(record) → CompressionStream('gzip') → AES-256-GCM → base64
Decrypt: base64 → AES-256-GCM → DecompressionStream('gzip') → JSON.parse
```

**Implementation:** Create `src/services/syncCrypto.ts` rather than modifying `src/services/crypto.ts`. The existing `crypto.ts` handles PBKDF2 key derivation and field-level encrypt/decrypt with `{ciphertext, iv}` return values. Sync crypto handles record-level transport encryption with a single base64 string return value. Different concerns, different module.

```typescript
// src/services/syncCrypto.ts
export async function encryptForSync(record: object, key: CryptoKey): Promise<string> {
  const json = JSON.stringify(record);
  const compressed = await compress(new TextEncoder().encode(json));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressed
  );
  // Prepend iv (12 bytes) to ciphertext, then base64-encode
  return base64Encode(concatBuffers(iv, ciphertext));
}

export async function decryptFromSync(blob: string, key: CryptoKey): Promise<object> {
  const raw = base64Decode(blob);
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const compressed = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const json = await decompress(new Uint8Array(compressed));
  return JSON.parse(new TextDecoder().decode(json));
}

// Compression helpers using Streams API
async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
```

**CompressionStream browser support:** Chrome 80+, Firefox 113+, Safari 16.4+ (~95% global). No polyfill needed given the PWA's existing browser targets.

The vault-derived `CryptoKey` (from `src/services/vault.ts` via PBKDF2) is reused as the sync encryption key. The same passphrase that unlocks the vault also encrypts sync payloads.

### A4: Conflict Resolution Algorithm (T029, T035, T042)

**Server-side (T029):** During push, the server detects conflicts:

```
For each pushed record:
  existing = SELECT * FROM sync_records WHERE id = ? AND user_id = ?
  if existing AND existing.updated_at > lastPullTimestamp:
    → Conflict: add existing (server version) to conflicts array
  else:
    → Accept: upsert with server-assigned updated_at = datetime('now')
```

**Client-side (T035):** During pull, the client applies remote changes with LWW:

```
For each remote record in pull response:
  local = await db.entries.get(remote.id)

  if remote.isTombstone:
    if local AND local has unsynced edits (check sync_queue for this ID):
      → Edit-wins-over-delete: skip tombstone, local edit pushes next cycle
    else:
      → Apply delete: db.entries.delete(remote.id) with isSyncing=true
    continue

  if local AND local.updatedAt > remote.updatedAt:
    → Local is newer: skip (local version pushes next cycle)
    continue

  decrypted = decryptFromSync(remote.encryptedPayload, vaultKey)
  await db.entries.put(decrypted) with isSyncing=true
  → If overwrote local version: emit conflict notification (T042)
```

**Edit-wins-over-delete rule:** If one device deletes and another edits the same entry, the edit is preserved. This reflects user intent — an edit implies the user wants to keep the entry. The tombstone is ignored and the edit syncs to all devices on the next push cycle.

### A5: Rate Limiting Strategy (T007, T044)

[research.md R2](./research.md#r2-cloudflare-workers--d1-for-sync-api-backend) recommends Cloudflare's built-in Rate Limiting binding. This is zero-cost, zero-latency, and requires no database queries.

[data-model.md](./data-model.md) includes a `rate_limits` D1 table as a fallback design. **Do not create this table in the initial schema migration (T007).** The built-in binding is the primary strategy. If it proves insufficient later (e.g., globally precise counters are needed instead of per-location counters), the `rate_limits` table schema in data-model.md serves as the migration plan.

### A6: Existing Codebase Context

Key existing files that tasks will modify. **Read these files before implementing the corresponding tasks.**

| File | Current State | Modified By |
|------|--------------|-------------|
| `src/routes/__root.tsx` | ~125 lines. Provider nesting: MantineProvider → VaultProvider → ErrorBoundary → layout. Layout renders: AutoLockWatcher, GlobalShortcuts (Cmd+N), SearchPalette, ReloadPrompt, StorageWarning, MultiTabWarning, Notifications, Outlet. | T015, T019, T025, T041, T053 |
| `src/db/schema.ts` | Dexie v1 with 3 tables: `vault_meta` ("id"), `entries` ("id, status, createdAt, updatedAt, [status+createdAt]"), `settings` ("key"). Typed `ReflogDB` class with `EntityTable` generics. | T013 |
| `src/db/index.ts` | Creates `db` instance, registers encryption middleware via `db.use(createEncryptionMiddleware())`. | T013, T033 |
| `src/db/encryption.ts` | Dexie DBCore middleware. Encrypted tables config: entries → [title, body, tags], settings → [value]. Uses `activeKey` (CryptoKey) set on vault unlock. Intercepts get, getMany, query, mutate. | T033 (ordering — see § A1) |
| `src/hooks/useVault.ts` | VaultState type: `loading \| no-vault \| locked \| unlocked`. Uses React Context with VaultProvider. Exposes: `status`, `setup(passphrase)`, `unlock(passphrase)`, `lock()`. | T020, T049 |
| `src/hooks/useAutoLock.ts` | Calls `autoLock.start()` when status is "unlocked". Registers activity listeners (mousedown, keydown, touchstart, scroll) to reset timer. Navigates to `/unlock` on timeout. | T028 |
| `src/hooks/useKeyboard.ts` | Thin wrapper: calls `keyboard.register(shortcut, deps)`, returns cleanup function. Actual shortcut logic lives in `src/services/keyboard.ts`. | T026 |
| `src/services/autoLock.ts` | `DEFAULT_TIMEOUT_MS = 300000` (5 min). Two lock triggers: (1) visibility change — locks immediately on tab hide, (2) inactivity timer. Exports: `start(callback, timeout?)`, `resetTimer()`, `stop()`. | T028 |
| `src/services/crypto.ts` | Web Crypto API. PBKDF2: 100K iterations, SHA-256. AES-GCM: 256-bit key, 12-byte IV, 16-byte salt. Functions: `generateSalt()`, `deriveKey(passphrase, salt) → CryptoKey`, `encrypt(plaintext, key) → {ciphertext: ArrayBuffer, iv: Uint8Array}`, `decrypt(ciphertext, iv, key) → string`. | Referenced by T035 (not modified — see § A3) |
| `src/services/vault.ts` | SENTINEL = "reflog-vault-check". Functions: `isSetUp()`, `setup(passphrase)` (generates salt, derives key, encrypts sentinel, stores vault_meta), `unlock(passphrase)` (derives key, verifies sentinel, builds search index), `lock()` (clears cryptoKey + search index), `isUnlocked()`. | T020 |
| `src/services/entries.ts` | CRUD on entries table. `list(options?)` filters by `status: "published"`. Functions: create, getById, list, update, remove, saveDraft, getDraft, publishDraft, discardDraft. All update the MiniSearch index. | T014 (downstream — must filter `deletedAt: null`) |
| `src/types/index.ts` | `Entry` = {id, title, body, tags, status, createdAt, updatedAt}. `VaultMeta` = {id, salt, verificationBlob, iv, createdAt}. `Setting` = {key, value}. Plus CreateEntryInput, UpdateEntryInput, EntryListResult DTOs. | T003, T014 |
| `src/components/common/MultiTabWarning.tsx` | Existing multi-tab detection component displayed in root layout. | T037 (evaluate: integrate or replace with sync coordinator) |
| `.github/workflows/ci.yml` | PR jobs: lint, typecheck, format-check, unit-tests (with coverage), e2e-tests (Playwright), dependency-audit. Deploy job (main only): version guard, build, copy _shell.html, deploy to Cloudflare Pages, create git tag. Node 22.x, Yarn. | T052 |

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@auth0/auth0-react` | ^2.15.0 | Auth0 React SDK (includes SPA SDK) |
| `hono` | ^4.x | Edge-native web framework (Worker) |
| `jose` | ^6.x | JWT verification in Workers runtime (Web Crypto API, zero deps) |
| `@cloudflare/workers-types` | latest | TypeScript types for Workers |

## Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Sync engine, conflict resolution, encryption, middleware |
| Contract | Vitest | API responses match OpenAPI schema |
| Integration | Vitest + Miniflare | Worker endpoints with D1 bindings |
| E2E | Playwright | Auth flow, sync between simulated devices, lock/logout |

## Cost Summary

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Auth0 Free Tier | $0 | 25,000 MAU |
| Cloudflare Workers Paid | $5 | 10M requests/month |
| Cloudflare D1 (first 5 GB) | $0 | Included in Workers Paid |
| D1 Storage (beyond 5 GB) | ~$0.75/GB | Scales with user count |
| **Total (1K users)** | **~$5-10** | Within SC-004 target |
