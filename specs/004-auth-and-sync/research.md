# Research: Authentication & Cross-Device Sync

**Feature**: 004-auth-and-sync | **Date**: 2026-02-21

## R1: Auth0 SPA Integration for React 19 + TanStack Start

**Decision**: Use `@auth0/auth0-react` v2.15.0 (wraps `@auth0/auth0-spa-js` v2.16.0)

**Rationale**: Official React SDK with full PKCE support, React 19 compatibility (since v2.3.0), and zero framework-specific constraints. Peer dependency `"react": "^16.11.0 || ^17 || ^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"` satisfies the project's `"react": "^19.0.0"`. The SDK handles token lifecycle, refresh rotation, and session management internally.

**Alternatives considered**:
- `@auth0/auth0-spa-js` directly — lower-level, no React hooks or context. Would require building `Auth0Provider` and `useAuth0` equivalents manually.
- AWS Cognito — more complex setup, Amplify SDK adds significant bundle weight, pricing comparable but less developer-friendly.
- Firebase Auth — ties into Google ecosystem, less control over branding, vendor lock-in concerns.

**Key findings**:

### Authentication Flow
- PKCE (Proof Key for Code Exchange) is the **only** flow used by the SPA SDK — enabled by default, no configuration needed.
- Universal Login (redirect-based) is strongly recommended over embedded login. User credentials never touch the app's domain.
- Auth0 dashboard settings: Application type = SPA, Token Auth Method = None, JWT Algorithm = RS256, Grant Type = Authorization Code.

### Token Strategy for PWA
```typescript
// Recommended Auth0Provider configuration
{
  useRefreshTokens: true,           // Refresh Token Rotation (avoids iframe/cookie issues)
  cacheLocation: "localstorage",    // Survives page reloads, needed for PWA
  authorizationParams: {
    scope: "openid profile email offline_access"
  }
}
```
- Silent auth via iframe fails when third-party cookies are blocked (Safari, Brave, Firefox ETP). Refresh tokens avoid this entirely.
- `cacheLocation: "localstorage"` is required for PWA persistence across page reloads. Tokens are stored as encrypted blobs by the SDK.
- Refresh Token Rotation must be enabled in Auth0 dashboard to prevent token reuse attacks.

### React Integration Pattern
- `Auth0Provider` goes in `src/routes/__root.tsx`, wrapping `<Outlet />`.
- `useAuth0()` returns: `isLoading`, `isAuthenticated`, `user`, `loginWithRedirect()`, `logout()`, `getAccessTokenSilently()`.
- Route protection via `withAuthenticationRequired` HOC or conditional rendering in components.

### JWT Structure
- **ID Token**: Standard OIDC claims (`sub`, `email`, `email_verified`, `name`, `picture`). `sub` format: `auth0|<id>` or `google-oauth2|<id>`.
- **Access Token**: JWT when `audience` is specified (required for API calls). Contains `sub`, `aud`, `scope`, `permissions`.
- Custom claims added via Auth0 Actions (post-login trigger), namespaced under `https://reflog.app/claims/`.

### Security Features (Free Tier)
- Brute-force protection: blocks IP+account after 10 consecutive failed attempts (configurable).
- Suspicious IP throttling: rate-limits high-volume failed logins across accounts.
- Breached password detection: checks against known breach databases.
- Email verification: automatic on signup, available via `user.email_verified` claim.

---

## R2: Cloudflare Workers + D1 for Sync API Backend

**Decision**: Standalone Cloudflare Worker with Hono framework + D1 (SQLite on edge) + `jose` for JWT verification.

**Rationale**: Cloudflare Workers provide edge-deployed compute with sub-millisecond cold starts, $5/month paid plan covers the project's scale target (1,000 users) with massive headroom, and D1 provides serverless SQLite without managing infrastructure.

**Alternatives considered**:
- Cloudflare Pages Functions — tied to Pages deployment lifecycle, harder to manage independently, limited middleware support.
- AWS Lambda + DynamoDB — higher operational complexity, colder cold starts, higher cost at low scale.
- Supabase — adds PostgreSQL complexity and another vendor dependency; row-level security is powerful but overkill for an encrypted blob store.
- Self-hosted (VPS + SQLite) — lowest cost but requires server management, patching, and scaling concerns.

**Key findings**:

### Architecture
- **Standalone Worker** (not Pages Functions): Deployed independently from the PWA. Has its own `wrangler.toml`, routes, and lifecycle. This avoids coupling the API to the frontend deployment.
- **Hono v4.x**: Lightweight web framework (~14KB) designed for edge runtimes. Express-like API with middleware support, TypeScript-native, zero Node.js dependencies.
- **jose v6.x**: JWT verification library built on the Web Crypto API (no Node.js `crypto` dependency). Verifies Auth0 RS256 tokens via `createRemoteJWKSet` + JWKS endpoint. Zero dependencies.

### D1 Cost Analysis

| Tier | Reads/day | Writes/day | Storage | Price |
|------|-----------|------------|---------|-------|
| Free | 5M/day | 100K/day | 5 GB (500 MB max per DB) | $0 |
| Paid | 25B/mo | 50M/mo | 5 GB free + $0.75/GB (10 GB max per DB) | $5/mo |

**Projection for 1,000 users** (10 syncs/day avg, 5 entries/sync):
- Writes: 1,000 × 10 × 5 = 50,000/day — free tier technically covers this but has no headroom for burst.
- Reads: 1,000 × 10 × 50 = 500,000/day — well within free tier.
- Storage: 1,000 users × 10,000 entries × 2KB avg = ~20 GB — requires paid tier ($11.25/mo storage).
- **Recommendation**: Start on paid plan ($5/mo) from day one. The free tier's 100K write/day limit is too tight for production. Total cost ~$5-15/mo depending on storage growth.

### Worker Request Limits

| Tier | Requests/day | CPU time/request | Subrequest limit |
|------|-------------|------------------|------------------|
| Free | 100K | 10ms | 50 |
| Paid | 10M/mo included | 30s | 50 (1000 for paid) |

### Rate Limiting
- Cloudflare provides a **native Rate Limiting binding** (available in wrangler v4.36.0+):
  ```toml
  [[rate_limits]]
  binding = "MY_RATE_LIMITER"
  namespace_id = "1001"
  simple = { limit = 100, period = 60 }
  ```
  Usage: `const { success } = await env.MY_RATE_LIMITER.limit({ key: userId })`.
  Period must be 10 or 60 seconds. Counters are local to the Cloudflare location (eventually consistent). Negligible latency.
- **Recommended**: Use the built-in binding for per-user rate limiting (zero-cost, zero-latency). Only fall back to D1/KV-based counters if globally precise rate limiting is needed.

### Batch Operations
- D1 supports batch statements in a single round trip: `db.batch([stmt1, stmt2, ...])`.
- Critical for sync push operations where multiple entries are written atomically.
- Batched statements are SQL transactions — if any statement fails, the entire sequence is rolled back.
- **Billing**: D1 billing is **row-based**, not query-based. A batch of 5 INSERTs writing 5 rows = 5 rows written. Additionally, each indexed column adds one write per INSERT/UPDATE. Factor this into write estimates.
- Despite row-based billing, batching is still valuable for reduced latency (single round-trip) and atomicity.

---

## R3: End-to-End Encrypted Sync Protocol Design

**Decision**: Push-then-pull delta sync with server-assigned timestamps, Dexie DBCore middleware for change tracking, and tombstone-based soft deletes.

**Rationale**: Delta sync minimizes bandwidth (only changed records are transmitted). Server-assigned timestamps eliminate clock skew issues. Dexie middleware captures changes transparently without modifying existing application code. Tombstones enable reliable deletion propagation across devices.

**Alternatives considered**:
- CRDTs (Conflict-free Replicated Data Types) — powerful but complex, overkill for a single-user journal with LWW resolution.
- Full-state sync (send everything) — simple but wasteful; prohibitive at scale with thousands of entries.
- Operational Transform (OT) — designed for real-time collaborative editing, unnecessary for async single-user sync.
- Third-party sync services (Replicache, PowerSync) — add vendor dependency and cost; opaque sync logic conflicts with zero-knowledge requirement.

**Key findings**:

### Sync Flow

```
Client                          Server
  │                               │
  ├─── POST /sync/push ──────────►│  1. Push local changes (encrypted)
  │    {changes: [...], lastPull}  │  2. Server stores, assigns timestamps
  │                               │  3. Server returns conflicts (if any)
  │◄── {conflicts, serverTime} ───┤
  │                               │
  ├─── GET /sync/pull?since=T ───►│  4. Pull remote changes since last pull
  │                               │  5. Server returns encrypted records
  │◄── {changes: [...], cursor} ──┤  6. Client decrypts and merges locally
  │                               │
```

### Change Tracking (Dexie DBCore Middleware)
- Intercept `mutate` operations (add, put, delete) at the database core level.
- For each mutation, write a record to the `sync_queue` table: `{tableName, recordId, operation, timestamp}`.
- Middleware is transparent — existing `useEntries()`, `useTags()`, etc. hooks work unchanged.
- Sync engine reads from `sync_queue`, encrypts payloads, and pushes to server.
- After successful push, processed queue entries are deleted.

### Conflict Resolution (Last-Write-Wins)
- Server assigns authoritative timestamps on receipt (`received_at`).
- During pull, if a remote record has a newer `received_at` than the local record's `updatedAt`, the remote version wins.
- Special case: edit vs. delete — edit wins (user intent to preserve takes precedence).
- Client displays a notification when a conflict is resolved: "Entry [title] was updated from another device."

### Tombstone-Based Soft Deletes
- Deleting an entry writes a tombstone record: `{id, deletedAt, type: 'tombstone'}`.
- Tombstones sync like regular records — other devices see the deletion and remove the entry locally.
- Server garbage-collects tombstones older than 90 days (configurable).
- Tombstones are small (~100 bytes encrypted) and impose negligible storage cost.

### Encryption Flow
```
Client writes entry:
  1. Serialize entry to JSON
  2. Compress with CompressionStream API ("gzip")
  3. Encrypt with AES-256-GCM using vault-derived key
  4. Base64-encode ciphertext
  5. Send encrypted blob to server

Client reads entry:
  1. Receive encrypted blob from server
  2. Base64-decode
  3. Decrypt with AES-256-GCM
  4. Decompress with DecompressionStream API
  5. Parse JSON, merge into local DB
```

**Compression notes**: CompressionStream/DecompressionStream support: Chrome 80+, Firefox 113+, Safari 16.4+ (~95% global). Achieves 60-80% compression on text-heavy journal content (10 KB → 2-4 KB). Must compress **before** encrypting — encrypted data is incompressible. Compression oracle attacks (CRIME/BREACH) are not applicable since entries are encrypted individually.

### Sync Triggers (Multi-Strategy)
| Trigger | Browser Support | Use Case |
|---------|----------------|----------|
| `visibilitychange` event | All browsers | Sync when tab becomes visible |
| `online` event | All browsers | Sync when connectivity returns |
| `setInterval` (60s) | All browsers | Periodic background sync |
| Debounced on data change (2s) | All browsers | Sync after user edits |
| Background Sync API | Chromium only | Sync via Service Worker when offline→online |

**Recommendation**: Use all four cross-browser triggers as the primary strategy. Register Background Sync API as a progressive enhancement for Chromium browsers only.

### Initial Device Setup
1. User authenticates on new device → gets access token.
2. Client calls `GET /sync/pull?since=0` → server returns all encrypted records.
3. User enters vault passphrase → client derives key and decrypts all records.
4. Records are written to local IndexedDB → device is fully set up.
5. Subsequent syncs use delta (only changes since last pull).

---

## R4: Client-Side State Management for Auth + Sync

**Decision**: Extend existing vault state machine with auth states. New hooks: `useAuth` (wraps Auth0), `useSyncEngine` (manages sync lifecycle).

**Rationale**: The existing `useVault` hook manages vault state (`loading → no-vault → locked → unlocked`). Auth adds a new dimension: `unauthenticated → authenticated`. The combined state space is: `unauthenticated | authenticated+no-vault | authenticated+locked | authenticated+unlocked`. Keeping auth and vault as separate concerns with a composed state avoids rewriting `useVault`.

**Key findings**:

### State Machine
```
                    ┌─────────────┐
                    │Unauthenticated│
                    └──────┬──────┘
                           │ login (Auth0 redirect)
                    ┌──────▼──────┐
              ┌─────│ Auth+NoVault │ (first time / cleared data)
              │     └──────┬──────┘
              │            │ setup vault
              │     ┌──────▼──────┐
              │     │ Auth+Locked  │◄── lock / auto-lock / tab blur
              │     └──────┬──────┘
              │            │ unlock (passphrase)
              │     ┌──────▼──────┐
              └────►│Auth+Unlocked │ ← sync active
                    └──────┬──────┘
                           │ logout
                    ┌──────▼──────┐
                    │Unauthenticated│
                    └─────────────┘
```

### Cross-Tab Coordination
- Auth0 SPA SDK uses `localStorage` for token cache. Changes propagate to other tabs automatically.
- **Web Locks API** (`navigator.locks.request`): Chrome 69+, Firefox 96+, Safari 15.4+ (~95.5% global). Use for leader election — one tab owns the sync loop; others defer.
- **BroadcastChannel API**: Chrome 54+, Firefox 38+, Safari 15.4+ (~95.7% global). Use to notify all tabs of sync results, lock/logout events, and sync requests from non-leader tabs.
- **Leader election pattern**: Each tab attempts `navigator.locks.request("sync-leader", ...)`. Only the holder runs the sync loop. When the leader tab closes, the lock auto-releases and another tab is promoted.
- Non-leader tabs write to `sync_queue` via DBCore middleware and send `"sync-requested"` on BroadcastChannel. Leader picks it up and syncs.

---

## R5: Auth0 Free Tier & Combined Cost Analysis

**Decision**: Auth0 free tier (25,000 MAU) + Cloudflare Workers paid plan ($5/month).

**Rationale**: Auth0's free tier generously covers the project's scale target. Cloudflare's paid plan is needed for D1 write headroom and rate limiting. Combined monthly cost: $5-15 depending on storage.

| Service | Tier | Monthly Cost | Covers |
|---------|------|-------------|--------|
| Auth0 | Free | $0 | 25,000 MAU, brute-force protection, email verification |
| Cloudflare Workers | Paid | $5 | 10M requests, 30s CPU/request |
| Cloudflare D1 | Included | $0 (first 5GB) | 25B reads, 50M writes/month |
| D1 Storage overage | Per GB | ~$0.75/GB | Beyond 5 GB |
| **Total (1K users)** | | **~$5-10/mo** | Well within SC-004 ($5 target) |

**Note**: SC-004 targets $5/month for 1,000 users. At low usage (early adoption), the $5 Workers plan alone covers everything. Storage costs only become relevant at scale (~20GB = 1,000 users × 10K entries).

---

## R6: Constitution Amendment Strategy

**Decision**: Amend Principle I from "Local-Only Data" to "Device-Encrypted Data" and replace the "no server-side components" ban with a constrained zero-knowledge server stack.

**Rationale**: The feature spec explicitly notes this as a dependency (see Assumptions > "Constitution evolution"). The amendment preserves the privacy intent (zero-knowledge, no plaintext server access) while enabling sync. This is a MAJOR version bump (2.0.0) per the amendment procedure since it redefines a core principle.

**Status**: ✅ **COMPLETED** — Constitution amended to v2.0.0 on 2026-02-21.

**Changes made**:
1. **Principle I title**: "Privacy-First, Local-Only Data" → "Privacy-First, Device-Encrypted Data"
2. **Principle I body**: Replaced "stored exclusively on the user's device" with zero-knowledge encryption boundary rules. Added explicit permitted/prohibited/constrained metadata categories.
3. **Architecture Boundaries**: Reorganized into Client (PWA) and Server (Sync API) subsections. Added Cloudflare Workers, D1, Auth0, Hono, jose to binding tech stack. Added "Server Permitted Use" section constraining server to auth, encrypted relay, and rate limiting only.
4. **Principle V**: Expanded to include authentication failures and sync errors as critical subsystems.
5. **Principle II**: Added explicit statement that sync is an enhancement, not a dependency.
6. **Principle III**: Added `Shift+Meta+L` keyboard shortcut.
7. **AI Agent Guidelines**: Updated security enforcement to reflect zero-knowledge server constraint.
8. **Version**: Bumped to 2.0.0 with Sync Impact Report.
