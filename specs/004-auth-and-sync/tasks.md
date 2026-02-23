# Tasks: Authentication & Cross-Device Sync

**Input**: Design documents from `/specs/004-auth-and-sync/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/sync-api.yaml, quickstart.md

**Tests**: Included. This feature involves encryption, authentication, and cross-device data integrity — test coverage is critical for correctness and security. Tests are grouped into a dedicated phase after all user stories are complete.

**Organization**: Tasks are grouped by user story. US3 (Session Management, P2) is ordered before US2 (Sync, P2) because it is simpler, builds directly on US1, and provides immediate user value without requiring the sync infrastructure. US2 is the largest phase, covering both server-side endpoints and client-side sync engine.

**Architecture Notes**: Several tasks involve cross-cutting implementation decisions (middleware ordering, encryption pipeline, conflict resolution). These are documented in [quickstart.md § Architecture Decision Notes](./quickstart.md#architecture-decision-notes) and referenced inline as `§ A1` through `§ A6`. Read the referenced note before starting the task.

**Existing Code Context**: Tasks that modify existing files include a reference to [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) which describes the current state of each file. Read the actual source file before modifying it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths and plan.md section references in descriptions

---

## Phase 1: Setup

**Purpose**: Scaffold the Worker project, install client dependencies, and establish shared type definitions. No functional code — just project structure.

- [x] T001 Scaffold Cloudflare Worker project at `workers/sync-api/` with `package.json` (dependencies: `hono`, `jose`, `@cloudflare/workers-types`), `tsconfig.json` (strict mode, no `any`), `wrangler.toml` (D1 binding, vars, compatibility flags), and `vitest.config.ts`. Use the project structure from [plan.md § Source Code](./plan.md#source-code-repository-root). Create empty `src/routes/`, `src/middleware/`, and `src/db/` directories. For the initial `wrangler.toml` shape, see [quickstart.md § Complete wrangler.toml Reference](./quickstart.md#complete-wrangler-toml-reference) — include `[vars]`, `[[d1_databases]]`, and compatibility flags; omit `[[rate_limits]]` and `[triggers]` until T044 and T047. For dependency versions, see [quickstart.md § Key Dependencies](./quickstart.md#key-dependencies).
- [x] T002 [P] Install `@auth0/auth0-react` in the PWA root: `yarn add @auth0/auth0-react`. Verify peer dependency compatibility with React 19 per [research.md R1](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) (peer dep: `"react": "^16.11.0 || ^17 || ^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"`).
- [x] T003 [P] Create shared sync type definitions at `src/types/sync.ts`: `SyncRecord`, `PushRequest`, `PushResponse`, `PullResponse`, `DeviceRegistration`, `Device`, `AccountUsage`, `ExportResponse`, `QuotaExceededError`, `SyncStatus` types matching [contracts/sync-api.yaml § components/schemas](./contracts/sync-api.yaml). Export from `src/types/index.ts`. See existing types at `src/types/index.ts` for the current `Entry`, `VaultMeta`, `Setting` interfaces ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)).
- [x] T004 [P] Create `.env.example` at repository root with Auth0 and sync API variable templates (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_SYNC_API_URL`) per [quickstart.md § Environment Variables](./quickstart.md#environment-variables). Add `.env.local` to `.gitignore` if not already present.

**Checkpoint**: Project structure exists. Worker has its own package.json and tsconfig. Shared types are available. No functional code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete manual setup steps, establish server infrastructure (D1 schema, Hono entry, JWT verification), and extend client-side Dexie schema for sync. ALL user stories depend on this phase.

**⚠ CRITICAL**: Phases 3–6 cannot begin until this phase is complete.

- [ ] T005 ⏳ **MANUAL**: Set up Auth0 account, create SPA application, create API (audience: `https://sync.reflog.microcode.io`), enable social connections (GitHub, Google), enable Refresh Token Rotation, configure Attack Protection (brute-force: 10 attempts/15 min, suspicious IP throttling, breached password detection). Follow [quickstart.md § Auth0 Setup](./quickstart.md#auth0-setup-one-time) steps 1–8 — note step 5 covers social connection setup (GitHub OAuth App + Google OAuth 2.0 credential). Record Auth0 Domain, Client ID, and API Audience.
- [ ] T006 ⏳ **MANUAL**: Subscribe to Cloudflare Workers Paid plan ($5/month), create D1 database (`npx wrangler d1 create reflog-sync`), record database ID in `workers/sync-api/wrangler.toml`. Worker is accessed via its `workers.dev` URL (no custom domain — Route 53/AWS manages `microcode.io`). Follow [quickstart.md § Cloudflare Workers Setup](./quickstart.md#cloudflare-workers-setup-one-time).
- [x] T007 Create D1 schema migration at `workers/sync-api/src/db/schema.sql` with `users`, `devices`, and `sync_records` tables per [data-model.md § Server-Side Schema](./data-model.md#server-side-schema-cloudflare-d1--sqlite). Include all indexes (`idx_users_auth0_sub`, `idx_devices_user_id`, `idx_sync_records_user_updated`, `idx_sync_records_user_type`, `idx_sync_records_tombstone_gc`). **Do NOT create the `rate_limits` table** — rate limiting uses Cloudflare's built-in binding instead (see [quickstart.md § A5](./quickstart.md#a5-rate-limiting-strategy-t007-t044)). Run migration against local D1 with `npx wrangler d1 execute reflog-sync --local --file=src/db/schema.sql`.
- [x] T008 [P] Implement Hono app entry point at `workers/sync-api/src/index.ts`: create Hono app with typed `Bindings` (DB: D1Database, RATE_LIMITER_IP, RATE_LIMITER_USER), mount CORS middleware (T010), mount route groups matching [contracts/sync-api.yaml](./contracts/sync-api.yaml) endpoint paths: `/api/v1/sync` (push, pull), `/api/v1/devices` (register, delete), `/api/v1/account` (usage, delete, export), `/api/v1/health`. Export default app. For the Hono pattern with Cloudflare Workers, see [research.md R2](./research.md#r2-cloudflare-workers--d1-for-sync-api-backend).
- [x] T009 [P] Implement JWT verification middleware at `workers/sync-api/src/middleware/auth.ts` using `jose` v6.x `createRemoteJWKSet` + `jwtVerify`. Verify Auth0 RS256 tokens against `https://{AUTH0_DOMAIN}/.well-known/jwks.json`. Extract `sub` claim and attach to Hono request context. Return 401 with error body matching [contracts/sync-api.yaml § responses/Unauthorized](./contracts/sync-api.yaml). AUTH0_DOMAIN and AUTH0_AUDIENCE are read from `env` bindings (see [quickstart.md § Complete wrangler.toml Reference](./quickstart.md#complete-wrangler-toml-reference) for var names). See [research.md R1 § JWT Structure](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) for token claims.
- [x] T010 [P] Implement CORS middleware at `workers/sync-api/src/middleware/cors.ts` allowing origins `http://localhost:3000` and `https://reflog.microcode.io`, methods GET/POST/DELETE/OPTIONS, headers Authorization/Content-Type. Hono has built-in CORS middleware via `import { cors } from 'hono/cors'`.
- [x] T011 Implement health endpoint at `workers/sync-api/src/routes/health.ts`: `GET /api/v1/health` returns `{ status: "ok", timestamp }` per [contracts/sync-api.yaml § /health](./contracts/sync-api.yaml). No auth required (`security: []`). Verify D1 connectivity with a simple `SELECT 1`.
- [x] T012 Create D1 prepared statement builders at `workers/sync-api/src/db/queries.ts`: user lookup by `auth0_sub`, user creation (columns per [data-model.md § users](./data-model.md#users)), device registration and listing (per [data-model.md § devices](./data-model.md#devices)), sync record upsert and query by `user_id + updated_at` (per [data-model.md § sync_records](./data-model.md#sync_records)), storage usage calculation (`SUM(payload_size_bytes)`). Use parameterized queries. See [research.md R2 § Batch Operations](./research.md#r2-cloudflare-workers--d1-for-sync-api-backend) for `db.batch()` usage pattern and row-based billing implications.
- [x] T013 [P] Extend Dexie schema to v2 at `src/db/schema.ts`: add `sync_queue` table (`++id, [tableName+recordId], timestamp`), add `sync_meta` table (`key`), modify `entries` indexes to include `deletedAt` and `syncVersion` per [data-model.md § Dexie Schema Migration](./data-model.md#dexie-schema-migration). Add upgrade handler to preserve existing v1 data (current v1 schema: `vault_meta: "id"`, `entries: "id, status, createdAt, updatedAt, [status+createdAt]"`, `settings: "key"` — see [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)). **Important**: The existing `src/db/index.ts` registers the encryption middleware via `db.use()`. The new sync tracking middleware (T033) must be registered BEFORE the encryption middleware — see [quickstart.md § A1](./quickstart.md#a1-dexie-middleware-ordering-t013-t033) for ordering details.
- [x] T014 [P] Update TypeScript interfaces at `src/types/index.ts`: add `syncVersion: number` and `deletedAt: string | null` fields to `Entry` interface. Current interface has 7 fields: `{id, title, body, tags, status, createdAt, updatedAt}` ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)). Default values: `syncVersion: 0`, `deletedAt: null`. **Downstream impact**: `src/services/entries.ts` `list()` currently filters by `status: "published"` — it must also filter `deletedAt: null` to exclude soft-deleted entries. Update `list()`, `getById()`, and any other query that retrieves visible entries.

**Checkpoint**: Auth0 and Cloudflare accounts are configured. Worker has D1 schema, Hono entry, JWT middleware, health endpoint, and query builders. Client Dexie schema is v2 with sync tables. All blocking infrastructure is ready.

---

## Phase 3: US1 — User Account & Authentication (Priority: P1) :dart: MVP

**Goal**: Users can create an account (email/password or social login via GitHub/Google), authenticate, and log out. The app gates all routes behind authentication. The vault state machine is extended to include auth states.

**Independent Test**: Create an account via Auth0, log in, verify the app loads, log out, verify the login screen appears. Log in again on a different browser to confirm the account persists. Test GitHub and Google social login.

### Implementation

- [x] T015 [US1] Add `Auth0Provider` to `src/routes/__root.tsx`: wrap the existing provider tree with Auth0Provider configured with `domain`, `clientId`, `useRefreshTokens={true}`, `cacheLocation="localstorage"`, `authorizationParams` (redirect_uri, audience, scope: `openid profile email offline_access`). Read config from `import.meta.env.VITE_AUTH0_*` (variable names in [quickstart.md § Environment Variables](./quickstart.md#environment-variables)). The current `__root.tsx` nests: MantineProvider → VaultProvider → ErrorBoundary → layout. Auth0Provider goes OUTSIDE MantineProvider as the outermost wrapper. See [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) for current file structure. See [research.md R1 § React Integration Pattern](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) for Auth0Provider config.
- [x] T016 [US1] Create `useAuth` hook at `src/hooks/useAuth.ts`: wraps `useAuth0()`, provides typed interface (`isAuthenticated`, `isLoading`, `user`, `login`, `logout`, `getToken`). The `user` object MUST include `sub`, `email`, `email_verified`, `name`, `picture` — see [research.md R1 § JWT Structure](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) for claim details. The `getToken` method calls `getAccessTokenSilently` with the API audience (`VITE_AUTH0_AUDIENCE`). `login` calls `loginWithRedirect`. `logout` calls Auth0 `logout` with `returnTo` pointing to the login route.
- [x] T017 [US1] Create login route at `src/routes/login.tsx`: displays the app logo, a "Sign in" button that calls `loginWithRedirect()`, and a brief description. If `isAuthenticated` is true, redirect to `/`. Auth0Provider handles the redirect callback automatically (processes `code` and `state` query params on return from Auth0 Universal Login). See [research.md R1 § Authentication Flow](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) for PKCE redirect mechanics. Use Mantine components consistent with existing UI (dark theme, monospace fonts — see `src/theme/index.ts`).
- [x] T018 [US1] Create `AuthGuard` component at `src/components/auth/AuthGuard.tsx`: checks `isAuthenticated` and `isLoading` from `useAuth`. If loading, show a centered Mantine Loader spinner. If not authenticated, redirect to `/login`. If authenticated, render children. Use conditional rendering rather than `withAuthenticationRequired` HOC for compatibility with TanStack Router's component model.
- [x] T019 [US1] Gate app routes behind `AuthGuard`: update `src/routes/__root.tsx` to wrap the main app layout (below Auth0Provider) with AuthGuard. The `/login` route MUST remain accessible without authentication. All other routes MUST require authentication: `/` (index.tsx — redirects to setup/unlock/timeline), `/timeline` (timeline.tsx), `/entry/new` (entry/new.tsx), `/entry/$id` (entry/$id/index.tsx), `/entry/$id/edit` (entry/$id/edit.tsx), `/setup` (setup.tsx), `/unlock` (unlock.tsx). See [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) for the current route structure and `__root.tsx` layout.
- [x] T020 [US1] Update `useVault` hook at `src/hooks/useVault.ts` to integrate with auth state. Current state machine is `loading → no-vault → locked → unlocked` ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)). The new combined state machine becomes: `unauthenticated → authenticated+no-vault → authenticated+locked → authenticated+unlocked`. Import `useAuth` and add `isAuthenticated` to the VaultState interface. The `setup` and `unlock` functions remain the same (in `src/services/vault.ts` — see [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)) but are only reachable when authenticated. See [research.md R4 § State Machine](./research.md#r4-client-side-state-management-for-auth--sync) for the full state diagram.
- [x] T021 [US1] Implement user lookup/creation middleware at `workers/sync-api/src/middleware/user.ts`: after JWT verification (T009), look up user by `auth0_sub` in D1 `users` table using query builders from T012. If not found, create a new user record with `auth0_sub`, `email` from JWT claims, and default `storage_quota_bytes` (50 MB per [data-model.md § users](./data-model.md#users)). Attach `userId` (internal UUID) to Hono request context for downstream handlers.
- [x] T022 [US1] Implement device registration endpoint at `workers/sync-api/src/routes/devices.ts`: `POST /api/v1/devices/register` accepts `DeviceRegistration` body (`{ name }`) per [contracts/sync-api.yaml § /devices/register](./contracts/sync-api.yaml), creates a device record (schema per [data-model.md § devices](./data-model.md#devices)) for the authenticated user (max 10 per user — return 409 if exceeded), returns `Device` response (`{ id, name, registeredAt }`). `DELETE /api/v1/devices/:deviceId` removes a device (return 404 if not found or not owned by user). Both require auth middleware (T009 + T021).
- [x] T023 [US1] Implement client-side device registration at `src/services/auth.ts`: on first successful login (detected via `sync_meta` table missing a `deviceId` key — see [data-model.md § sync_meta](./data-model.md#sync_meta) for key names), call `POST /api/v1/devices/register` with the `navigator.userAgent` string, store the returned `deviceId` in `sync_meta`. Use the `getToken` method from `useAuth` (T016) to include the access token in the `Authorization: Bearer` header. API base URL from `import.meta.env.VITE_SYNC_API_URL` ([quickstart.md § Environment Variables](./quickstart.md#environment-variables)).

**Checkpoint**: Users can create accounts (email/password, GitHub, Google), log in, and log out. All routes are gated behind authentication. The vault state machine includes auth states. Devices are registered on the server. This is a working MVP — the app is usable with auth even before sync is implemented.

---

## Phase 4: US3 — Enhanced Session Management (Priority: P2)

**Goal**: Users have clear, distinct "lock" and "logout" actions. Lock clears the vault key but preserves the session. Logout ends the session entirely with an option to keep or clear local data.

**Independent Test**: Lock the session — verify passphrase is required to resume but user stays authenticated. Log out — verify the keep/clear data dialog appears, session ends, and behavior matches the user's choice.

### Implementation

- [x] T024 [P] [US3] Create `AccountMenu` component at `src/components/auth/AccountMenu.tsx`: dropdown/popover triggered by the user's avatar or initials in the header. Menu items: user email (display only, from `useAuth().user.email`), "Lock" (calls `vault.lock()`), "Log Out" (triggers logout flow from T027). Use Mantine Menu component. Follow existing Mantine dark theme patterns in `src/theme/index.ts`.
- [x] T025 [P] [US3] Add persistent lock icon button to the app header in `src/routes/__root.tsx` (within the header layout area alongside the existing GlobalShortcuts and SearchPalette — see [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)): a small lock icon visible on all screens when the vault is unlocked. Clicking it calls `vault.lock()`. Use Mantine ActionIcon with a lock icon from `@tabler/icons-react` (already a project dependency).
- [x] T026 [US3] Register `Shift+Meta+L` keyboard shortcut for lock: the existing `src/hooks/useKeyboard.ts` is a thin wrapper around `src/services/keyboard.ts` which manages a global keydown listener ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)). Add the new shortcut using the existing pattern — call `useKeyboard({ key: "l", shift: true, meta: true }, callback)` in the root layout or a dedicated component. When triggered, call `vault.lock()`. Only register when vault is in `unlocked` state. This shortcut is required by the constitution (Principle III).
- [x] T027 [US3] Implement logout flow with keep/clear data dialog at `src/services/auth.ts`: create a `performLogout(clearData: boolean)` function. If `clearData` is true, clear all Dexie tables (`entries`, `sync_queue`, `sync_meta`, `settings` — table names per [data-model.md § Client-Side Schema](./data-model.md#client-side-schema-dexiejs--indexeddb)) before calling Auth0 `logout()`. If false, just call `logout()`. The `AccountMenu` component (T024) shows a Mantine Modal with "Keep local data" and "Clear local data" buttons on logout click.
- [x] T028 [US3] Verify auto-lock compatibility: ensure `src/hooks/useAutoLock.ts` and `src/services/autoLock.ts` work correctly with the new auth state. Current behavior: `autoLock.start()` triggers on `status === "unlocked"`, locks on both tab visibility change (immediate) and inactivity timer (5 min default) — see [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context). Auto-lock MUST only fire when in `authenticated+unlocked` state (not when unauthenticated). Lock on tab blur MUST be preserved. The `useAutoLock` hook should check `isAuthenticated` from `useAuth` before scheduling auto-lock.

**Checkpoint**: Lock and logout are distinct, accessible actions. Lock button in header, lock in account menu, Shift+Meta+L shortcut all work. Logout offers keep/clear choice. Auto-lock preserved.

---

## Phase 5: US2 — Cross-Device Encrypted Sync (Priority: P2)

**Goal**: Journal entries, tags, and settings sync across all devices where the user is authenticated and the vault is unlocked. All data is end-to-end encrypted. The server never sees plaintext. Conflicts resolved via LWW with server-assigned timestamps.

**Independent Test**: Log in on two browser profiles. Create an entry on device A. Verify it appears on device B within 30 seconds. Edit the entry on device B. Verify the edit propagates to device A. Delete the entry on device A. Verify it disappears from device B.

### Server-Side (Sync API)

- [x] T029 [US2] Implement sync push endpoint at `workers/sync-api/src/routes/sync.ts`: `POST /api/v1/sync/push` accepts `PushRequest` body per [contracts/sync-api.yaml § /sync/push](./contracts/sync-api.yaml) (changes array, deviceId, lastPullTimestamp). For each change: upsert into `sync_records` (columns per [data-model.md § sync_records](./data-model.md#sync_records)) with server-assigned `updated_at = datetime('now')`. Detect conflicts per [quickstart.md § A4](./quickstart.md#a4-conflict-resolution-algorithm-t029-t035-t042): if a record was modified since `lastPullTimestamp`, return the server version in the conflicts array. Update `users.storage_used_bytes`. Use `db.batch()` for atomicity ([research.md R2 § Batch Operations](./research.md#r2-cloudflare-workers--d1-for-sync-api-backend)). Return 507 `QuotaExceededError` if `storage_used_bytes` exceeds `storage_quota_bytes`. Return `PushResponse` (accepted count, conflicts, serverTimestamp). Use query builders from T012.
- [x] T030 [US2] Implement sync pull endpoint at `workers/sync-api/src/routes/sync.ts`: `GET /api/v1/sync/pull?since=&cursor=&limit=` per [contracts/sync-api.yaml § /sync/pull](./contracts/sync-api.yaml). Query `sync_records WHERE user_id = ? AND updated_at > ?` using the `idx_sync_records_user_updated` index ([data-model.md § sync_records indexes](./data-model.md#sync_records)), ordered by `updated_at`, with cursor-based pagination (default limit 100, max 500). Return `PullResponse` (changes array, hasMore, cursor, serverTimestamp). Use query builders from T012.
- [x] T031 [P] [US2] Implement account endpoints at `workers/sync-api/src/routes/account.ts` per [contracts/sync-api.yaml](./contracts/sync-api.yaml): `GET /api/v1/account/usage` returns `AccountUsage` (`storageUsedBytes`, `storageQuotaBytes`, `recordCount`, `deviceCount`). `DELETE /api/v1/account` permanently deletes the user — `ON DELETE CASCADE` on `devices` and `sync_records` foreign keys handles cleanup ([data-model.md § Entity Relationships](./data-model.md#entity-relationships)). `GET /api/v1/account/export` returns `ExportResponse` with all sync_records for the user as a JSON array.
- [x] T032 [US2] Update `workers/sync-api/src/middleware/user.ts` (created in T021) to also update `devices.last_seen_at` column ([data-model.md § devices](./data-model.md#devices)) on each authenticated request. The `deviceId` comes from the request (push body or query param) — match against the user's registered devices.

### Client-Side (Sync Engine)

- [x] T033 [US2] Implement Dexie DBCore middleware at `src/db/middleware.ts`: intercept `mutate` operations (add, put, delete) on synced tables (`entries`, `settings`, `vault_meta`). For each mutation, write a record to `sync_queue` with fields per [data-model.md § sync_queue](./data-model.md#sync_queue) (`tableName`, `recordId`, `operation`, `timestamp`, `payload`). Skip writes to `sync_queue` and `sync_meta` tables to avoid recursion. Implement the `isSyncing` flag per [quickstart.md § A2](./quickstart.md#a2-the-issyncing-flag-t033-t035-t043) — export `setSyncing()` for use by the sync engine (T035). **Critical**: Register this middleware BEFORE the existing encryption middleware in `src/db/index.ts` so it captures plaintext — see [quickstart.md § A1](./quickstart.md#a1-dexie-middleware-ordering-t013-t033) for ordering details and the existing middleware in `src/db/encryption.ts` ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)). See [research.md R3 § Change Tracking](./research.md#r3-end-to-end-encrypted-sync-protocol-design) for the overall middleware design.
- [x] T034 [US2] Create sync API client at `src/services/syncApi.ts`: typed HTTP client for the sync API. Methods match [contracts/sync-api.yaml](./contracts/sync-api.yaml) endpoints: `push(token, request: PushRequest): PushResponse`, `pull(token, since, cursor?, limit?): PullResponse`, `registerDevice(token, name): Device`, `deleteDevice(token, deviceId): void`, `getUsage(token): AccountUsage`, `deleteAccount(token): void`, `exportData(token): ExportResponse`. All methods include `Authorization: Bearer {token}` header. Base URL from `import.meta.env.VITE_SYNC_API_URL` ([quickstart.md § Environment Variables](./quickstart.md#environment-variables)). Handle error responses: 401 (re-auth), 429 (parse `Retry-After` header, auto-retry), 507 (surface QuotaExceededError to UI). Use types from `src/types/sync.ts` (T003).
- [x] T035 [US2] Implement sync engine at `src/services/sync.ts`: core `SyncEngine` class with `push()` and `pull()` methods. **Push**: read all entries from `sync_queue`, deduplicate by `[tableName+recordId]` (keep latest per [data-model.md § sync_queue Deduplication](./data-model.md#sync_queue)), encrypt each payload using `encryptForSync()` from `src/services/syncCrypto.ts` (new file — see [quickstart.md § A3](./quickstart.md#a3-sync-encryption-pipeline-t035-t056) for the full pipeline and implementation), build `PushRequest` per [contracts/sync-api.yaml § PushRequest](./contracts/sync-api.yaml), send via `syncApi.push()` (T034), delete processed queue entries on success, handle conflicts per [quickstart.md § A4](./quickstart.md#a4-conflict-resolution-algorithm-t029-t035-t042). **Pull**: call `syncApi.pull(since=lastPullTimestamp)` — `lastPullTimestamp` stored in `sync_meta` ([data-model.md § sync_meta](./data-model.md#sync_meta)), paginate until `hasMore=false`, for each change apply LWW per [quickstart.md § A4](./quickstart.md#a4-conflict-resolution-algorithm-t029-t035-t042): if tombstone → delete local record, else → `decryptFromSync()` and upsert locally with `setSyncing(true)` to suppress middleware ([quickstart.md § A2](./quickstart.md#a2-the-issyncing-flag-t033-t035-t043)). Update `sync_meta.lastPullTimestamp`. The vault-derived `CryptoKey` from `src/services/vault.ts` ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)) is passed to the sync engine on initialization. See [research.md R3 § Sync Flow](./research.md#r3-end-to-end-encrypted-sync-protocol-design) for the overall push-then-pull pattern.
- [x] T036 [US2] Implement sync scheduler at `src/services/syncScheduler.ts`: manages sync triggers. Four cross-browser strategies per [research.md R3 § Sync Triggers](./research.md#r3-end-to-end-encrypted-sync-protocol-design): (1) `visibilitychange` → sync when tab becomes visible, (2) `online` event → sync when connectivity returns, (3) `setInterval(60s)` → periodic sync while tab is active, (4) debounced on data change (2s after last mutation, triggered via callback from DBCore middleware T033). Register Background Sync API as progressive enhancement for Chromium browsers via the existing Service Worker (project uses `vite-plugin-pwa` with Workbox — see `vite.config.ts`). All triggers call `syncEngine.push()` then `syncEngine.pull()`. Guard with `navigator.onLine` check. Export `start()`, `stop()`, `requestSync()` methods.
- [x] T037 [US2] Implement cross-tab sync coordinator at `src/services/syncCoordinator.ts`: use Web Locks API for leader election — one tab owns the sync loop, others defer. Use BroadcastChannel (`"reflog-sync"`) for inter-tab communication: leader broadcasts `sync-complete` with changed entry IDs after each sync; non-leader tabs broadcast `sync-requested` when they have local changes; leader picks up requests and triggers sync. On leader tab close, Web Lock auto-releases and another tab is promoted. Fallback to localStorage heartbeat if Web Locks unavailable (~95% browser support). See [research.md R4 § Cross-Tab Coordination](./research.md#r4-client-side-state-management-for-auth--sync). **Note**: The existing `src/components/common/MultiTabWarning.tsx` already handles multi-tab detection ([quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)) — evaluate whether it should be replaced by the sync coordinator's leader/follower model or kept as a separate concern.
- [x] T038 [US2] Implement initial device setup at `src/services/sync.ts` (extend SyncEngine): when `sync_meta.lastPullTimestamp` is absent ([data-model.md § sync_meta](./data-model.md#sync_meta) — new device indicator), perform full pull with `since=1970-01-01T00:00:00Z`. Decrypt and bulk-insert records page by page (100 per page, using `setSyncing(true)` per [quickstart.md § A2](./quickstart.md#a2-the-issyncing-flag-t033-t035-t043)). Emit progress events for the SyncIndicator (T040) to display during initial sync. After completion, store `lastPullTimestamp` and mark device as synced. See [research.md R3 § Initial Device Setup](./research.md#r3-end-to-end-encrypted-sync-protocol-design) for the full flow.
- [x] T039 [US2] Create `useSyncStatus` hook at `src/hooks/useSyncStatus.ts`: exposes current sync state (`synced`, `syncing`, `offline`, `error`, `initial-sync`) and last sync timestamp. Listens to BroadcastChannel (`"reflog-sync"` — same channel as T037) for sync events from the leader tab. Updates reactively based on `navigator.onLine`, sync engine state, and `sync_meta` values from [data-model.md § sync_meta](./data-model.md#sync_meta).
- [x] T040 [US2] Create `SyncIndicator` component at `src/components/sync/SyncIndicator.tsx`: subtle icon in the app header showing sync state. Use Mantine Tooltip for hover details (last sync time, error message if any). States: cloud-check (synced), spinning arrows (syncing), cloud-off (offline), exclamation (error), download (initial-sync). Consume `useSyncStatus` hook (T039). Use `@tabler/icons-react` icons consistent with existing UI.
- [x] T041 [US2] Add `SyncIndicator` to app header in `src/routes/__root.tsx`: place next to the lock button (T025) and account menu (T024). Only visible when authenticated and vault is unlocked. See [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) for the current header layout structure.
- [x] T042 [US2] Implement conflict notification: when `syncEngine.pull()` resolves a conflict via LWW ([quickstart.md § A4](./quickstart.md#a4-conflict-resolution-algorithm-t029-t035-t042)), display a Mantine notification/toast: "Entry '[title]' was updated from another device." For edit-vs-delete conflicts: "Entry '[title]' was deleted on another device but your recent edit was preserved." Use `@mantine/notifications` `notifications.show()` (already configured in existing `__root.tsx` via `<Notifications />` component).
- [x] T043 [US2] Initialize sync engine in the app lifecycle: in `src/routes/__root.tsx` (or a dedicated `SyncProvider` component), start the sync scheduler (T036) when vault state transitions to `authenticated+unlocked`. Stop the scheduler on lock or logout. Pass the vault-derived `CryptoKey` to the sync engine. Connect the DBCore sync middleware (T033) on Dexie database creation in `src/db/index.ts` — registration order per [quickstart.md § A1](./quickstart.md#a1-dexie-middleware-ordering-t013-t033). Initialize the cross-tab coordinator (T037) alongside the scheduler. See [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) for the current `__root.tsx` lifecycle (AutoLockWatcher + GlobalShortcuts pattern).

**Checkpoint**: Full bidirectional sync is working. Entries created on one device appear on another. Offline changes queue and sync on reconnect. Conflicts are resolved via LWW with user notification. Sync indicator shows real-time state. Cross-tab coordination prevents duplicate syncs.

---

## Phase 6: US4 — Abuse Protection & Cost Management (Priority: P3)

**Goal**: The sync API is protected against DDoS, malicious account creation, and excessive usage. Hosting costs remain within budget.

**Independent Test**: Simulate rapid API requests from a single IP — verify rate limiting activates (429 response with Retry-After header). Send an oversized request body — verify 413 rejection. Check Cloudflare analytics for request patterns.

### Implementation

- [x] T044 [US4] Implement rate limiting middleware at `workers/sync-api/src/middleware/rateLimit.ts`: use Cloudflare's built-in Rate Limiting binding (see [quickstart.md § A5](./quickstart.md#a5-rate-limiting-strategy-t007-t044) for strategy rationale). Add `[[rate_limits]]` bindings to `workers/sync-api/wrangler.toml` (see [quickstart.md § Complete wrangler.toml Reference](./quickstart.md#complete-wrangler-toml-reference) for exact config). Two limiters: (1) `RATE_LIMITER_IP` for unauthenticated endpoints (100 requests/60s, keyed by IP), (2) `RATE_LIMITER_USER` for authenticated endpoints (200 requests/60s, keyed by userId). Usage: `const { success } = await env.RATE_LIMITER_USER.limit({ key: userId })`. Return 429 with `Retry-After` header per [contracts/sync-api.yaml § responses/RateLimited](./contracts/sync-api.yaml). See [research.md R2 § Rate Limiting](./research.md#r2-cloudflare-workers--d1-for-sync-api-backend).
- [x] T045 [P] [US4] Implement request validation middleware at `workers/sync-api/src/middleware/validation.ts`: reject requests with `Content-Length > 256KB` (413 per [contracts/sync-api.yaml § 413 response](./contracts/sync-api.yaml)), validate `Content-Type: application/json` for POST requests, validate required fields in push request body (`changes` array with max 100 items, `deviceId`, `lastPullTimestamp` — per [contracts/sync-api.yaml § PushRequest](./contracts/sync-api.yaml)). Validate `encryptedPayload` max length (350,000 chars per SyncRecord schema). Apply to sync endpoints.
- [x] T046 [US4] ~~**MANUAL**: Configure Auth0 bot detection~~ — **DESCOPED**: Bot Detection requires an Auth0 Enterprise subscription, which is out of scope for this project. Account creation throttling relies on Auth0's built-in Attack Protection (brute-force protection, suspicious IP throttling, breached password detection) configured in T005, plus the server-side IP rate limiting in T044.
- [x] T047 [US4] Implement tombstone garbage collection as a scheduled Worker: add `[triggers] crons = ["0 3 * * *"]` to `wrangler.toml` (see [quickstart.md § Complete wrangler.toml Reference](./quickstart.md#complete-wrangler-toml-reference)). In the `scheduled` event handler in `workers/sync-api/src/index.ts`, delete from `sync_records` where `is_tombstone = 1 AND updated_at < datetime('now', '-90 days')` using the `idx_sync_records_tombstone_gc` index ([data-model.md § sync_records indexes](./data-model.md#sync_records)). Log the number of purged records. See [research.md R3 § Tombstone-Based Soft Deletes](./research.md#r3-end-to-end-encrypted-sync-protocol-design) for the 90-day retention rationale.

**Checkpoint**: Rate limiting is active on all endpoints. Oversized requests are rejected. Auth0 Attack Protection (brute-force, suspicious IP, breached password) is configured. Tombstones are garbage-collected after 90 days.

---

## Phase 7: Migration, Data Governance & Polish

**Purpose**: Handle MVP → account migration, implement account deletion and data export (FR-019, FR-020), and prepare for deployment.

- [x] T048 Create migration route at `src/routes/migrate.tsx`: displayed when an authenticated user has an existing local vault but no `sync_meta.deviceId` ([data-model.md § sync_meta](./data-model.md#sync_meta) — first launch after upgrade from MVP). Shows a message explaining the transition from local-only to synced mode. On confirmation: register device with server (via `syncApi.registerDevice()` from T034), perform initial push of all local data — read all entries from Dexie, encrypt each with `encryptForSync()` ([quickstart.md § A3](./quickstart.md#a3-sync-encryption-pipeline-t035-t056)), push via sync engine (T035), update `sync_meta` with device ID and sync timestamps. If network fails, allow retry without data loss (push is idempotent — server upserts by record ID). See spec FR-005a and [research.md R3 § Initial Device Setup](./research.md#r3-end-to-end-encrypted-sync-protocol-design) for the flow.
- [x] T049 Implement migration detection in `src/hooks/useVault.ts`: after authentication (check `useAuth().isAuthenticated`), check if local vault exists (`vault.isSetUp()` — see [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) for current `src/services/vault.ts`) AND `sync_meta.deviceId` is absent ([data-model.md § sync_meta](./data-model.md#sync_meta)). If so, redirect to `/migrate` instead of the normal unlock flow. After successful migration, proceed to normal `authenticated+locked` state.
- [x] T050 [P] Implement account deletion flow in client: add "Delete Account" option to `AccountMenu` (T024). Show a Mantine Modal confirmation dialog requiring the user to type their email to confirm. On confirmation, call `syncApi.deleteAccount()` (T034, endpoint per [contracts/sync-api.yaml § DELETE /account](./contracts/sync-api.yaml)), clear all local Dexie data (all tables per [data-model.md § Client-Side Schema](./data-model.md#client-side-schema-dexiejs--indexeddb)), call Auth0 `logout()`, redirect to login.
- [x] T051 [P] Implement data export flow in client: add "Export Data" option to `AccountMenu` (T024). Call `syncApi.exportData()` (T034, endpoint per [contracts/sync-api.yaml § /account/export](./contracts/sync-api.yaml)), receive `ExportResponse` with encrypted records, decrypt each using `decryptFromSync()` ([quickstart.md § A3](./quickstart.md#a3-sync-encryption-pipeline-t035-t056)), assemble into a JSON file with entries, settings, and metadata, trigger browser download as `reflog-export-{date}.json`.
- [x] T052 Update CI workflow at `.github/workflows/ci.yml`: add a `worker-typecheck` job that runs `cd workers/sync-api && npm install && npx tsc --noEmit` to typecheck the Worker code. Add it to the existing PR jobs (currently: lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit — see [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context)). Worker deployment to production is automated via CI (T064).
- [x] T053 Update `src/routes/__root.tsx` to integrate all new components into the root layout: ensure Auth0Provider wraps everything (outermost, above MantineProvider), AuthGuard gates the app (below Auth0Provider), header contains LockButton (T025), SyncIndicator (T040), and AccountMenu (T024) in correct order, sync engine initializes on vault unlock (T043). Verify no import ordering issues. See [quickstart.md § A6](./quickstart.md#a6-existing-codebase-context) for the current `__root.tsx` structure: MantineProvider → VaultProvider → ErrorBoundary → layout with AutoLockWatcher, GlobalShortcuts, SearchPalette, ReloadPrompt, StorageWarning, MultiTabWarning, Notifications, Outlet.

#### Error Boundaries (Constitution Principle V)

- [x] T053a [P] Create auth error boundary at `src/components/auth/AuthErrorBoundary.tsx`: wrap Auth0Provider children to catch authentication failures (expired tokens, revoked sessions, network errors during auth). Display a user-friendly error screen with "Try again" and "Log out" actions. Catch Auth0 `OAuthError` and generic network errors from `getAccessTokenSilently`. Log errors to console for debugging. This satisfies Constitution Principle V (Robust Error Boundaries) for auth subsystem failures. Wire into `src/routes/__root.tsx` between Auth0Provider and AuthGuard.
- [x] T053b [P] Create sync error boundary at `src/components/sync/SyncErrorBoundary.tsx`: catch sync failures (network errors, encryption/decryption failures, quota exceeded, unexpected API responses) and surface them via the SyncIndicator (T040) error state and Mantine notifications. Sync errors MUST NOT crash the app or block offline usage — degrade gracefully to offline-only mode. Handle: `QuotaExceededError` (show usage guidance), decryption failures (likely wrong passphrase — prompt re-lock), network errors (switch to offline state, auto-retry on reconnect). This satisfies Constitution Principle V for sync subsystem failures.

**Checkpoint**: MVP users can migrate seamlessly. Account deletion and data export work end-to-end. CI typechecks the Worker. Root layout is fully integrated. Auth and sync error boundaries ensure graceful degradation per Constitution Principle V.

---

## Phase 8: Testing & Verification

**Purpose**: Validate all user stories with automated tests. Run the full quality gate. Deploy and verify in production.

- [x] T054 [P] Unit tests for sync engine at `tests/unit/sync.test.ts`: test push preparation (queue dedup per [data-model.md § sync_queue Deduplication](./data-model.md#sync_queue), encryption round-trip per [quickstart.md § A3](./quickstart.md#a3-sync-encryption-pipeline-t035-t056)), pull application (decrypt, merge, tombstone handling per [data-model.md § Entry Lifecycle](./data-model.md#state-transitions)), conflict resolution (LWW, edit-wins-over-delete per [quickstart.md § A4](./quickstart.md#a4-conflict-resolution-algorithm-t029-t035-t042)), and sync queue lifecycle. Use `fake-indexeddb` for Dexie mocking (already a dev dependency).
- [x] T055 [P] Unit tests for DBCore middleware at `tests/unit/syncMiddleware.test.ts`: test that add/put/delete mutations on `entries` table create `sync_queue` records (schema per [data-model.md § sync_queue](./data-model.md#sync_queue)), that `sync_queue` and `sync_meta` tables are excluded from tracking, and that the `isSyncing` flag suppresses queue writes (per [quickstart.md § A2](./quickstart.md#a2-the-issyncing-flag-t033-t035-t043)). Test middleware ordering with encryption middleware (per [quickstart.md § A1](./quickstart.md#a1-dexie-middleware-ordering-t013-t033)).
- [x] T056 [P] Unit tests for encryption round-trip at `tests/unit/syncEncryption.test.ts`: test the sync encryption pipeline (JSON → compress → encrypt → decrypt → decompress → JSON) from `src/services/syncCrypto.ts` per [quickstart.md § A3](./quickstart.md#a3-sync-encryption-pipeline-t035-t056). Test with various entry sizes (empty, small, 100KB). Test with invalid key (should throw). Verify compression achieves measurable reduction on text-heavy content.
- [x] T057 Contract tests for sync API at `tests/contract/syncApi.test.ts`: validate that sync push/pull request and response shapes match the OpenAPI schema in [contracts/sync-api.yaml](./contracts/sync-api.yaml). Test 401 on missing token, 429 on rate limit (with Retry-After header), 507 on quota exceeded (QuotaExceededError body), 413 on oversized payload.
- [x] T058 Integration tests for Worker endpoints at `workers/sync-api/tests/integration/sync.test.ts`: use Miniflare to test push, pull, device registration, account deletion, and storage quota enforcement with a real D1 database. Test the full sync cycle: push records from "device A", pull from "device B", verify data integrity. Test conflict detection (push after another device has modified the same record). Test tombstone GC (T047). See [quickstart.md § Testing Strategy](./quickstart.md#testing-strategy).
- [x] T059 E2E tests for auth flow at `tests/e2e/auth.spec.ts`: Playwright tests for login (redirect to Auth0, callback), logout (with keep/clear data), lock (passphrase required to resume), and Shift+Meta+L shortcut. Note: Auth0 redirect testing may require test credentials or Auth0's testing tools. Consider creating a dedicated Auth0 test tenant with test users. See existing Playwright tests in `tests/e2e/` for project patterns (e.g., `setup-unlock.spec.ts` for vault flow testing).
- [x] T060 E2E tests for sync flow at `tests/e2e/sync.spec.ts`: Playwright tests simulating multi-device sync. Create an entry in browser context A, verify it appears in browser context B (using separate Playwright contexts with shared auth). Test offline queue: disconnect network (via Playwright network emulation), create entry, reconnect, verify sync. See existing `tests/e2e/offline.spec.ts` for the project's offline testing pattern.
- [x] T060a Validate performance criteria: (1) SC-005 — measure sync round-trip time (push + pull) for a typical 5-entry sync on broadband; verify 95th percentile < 2 seconds. Test with Playwright network timing or `performance.now()` instrumentation in the sync engine. (2) SC-008 — measure lock and logout action time; verify < 2 seconds from button click to visual confirmation. (3) SC-006 — measure 429 rejection latency for rate-limited requests; verify < 100ms. Document results as a comment in the PR. These are the performance success criteria from spec.md that have no other dedicated test tasks.
- [x] T061 Run full quality gate locally: `yarn typecheck && yarn lint && yarn test && yarn build && yarn test:e2e`. All must pass. Also run Worker typecheck: `cd workers/sync-api && npx tsc --noEmit`. This is the gate required by Constitution Principle VI.
- [x] T062 **INITIAL ONLY**: Deploy Worker to production for the first time: `cd workers/sync-api && npx wrangler deploy`. Run D1 migration against remote: `npx wrangler d1 execute reflog-sync --remote --file=src/db/schema.sql`. Set secrets per [quickstart.md § Environment Variables](./quickstart.md#environment-variables): `npx wrangler secret put AUTH0_DOMAIN`, `npx wrangler secret put AUTH0_AUDIENCE`. Verify `https://reflog-sync-api.greg-coonrod.workers.dev/api/v1/health` returns 200. **Note**: Subsequent deployments are automated via CI (T064).
- [x] T064 Add Worker deployment with atomic rollback to CI deploy job at `.github/workflows/ci.yml`: deploy the sync API Worker alongside Cloudflare Pages on merge to main. Deployment order: D1 migrations (`wrangler d1 execute reflog-sync --remote`) → Worker deploy (`cloudflare/wrangler-action@v3` with `workingDirectory: workers/sync-api`) → health check (curl `/api/v1/health` with 5x retry, 5s delay) → Pages deploy → git tag. On failure after Worker deploys, `wrangler rollback --name=reflog-sync-api --yes` restores the previous Worker version. Pages never needs explicit rollback (failed deploy leaves previous version active). D1 migrations are NOT rolled back (all DDL uses `CREATE IF NOT EXISTS`). Step IDs: `d1-migrations`, `worker-deploy`, `health-check`, `pages-deploy`. Deployment summary shows component status table. Rollback summary on failure shows each component's outcome.
- [ ] T063 End-to-end production verification: create an account on `https://reflog.microcode.io`, create a journal entry, open the app on a second device/browser, log in, unlock vault, verify the entry syncs. Test lock, logout, and re-login flows. Verify sync indicator states (synced, syncing, offline). Check Cloudflare analytics for request metrics.

**Checkpoint**: All tests pass. Quality gate clean. Worker deployed (initial manual + subsequent via CI with atomic rollback). Production sync verified end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)           ─┐
                            ├─→ Phase 3 (US1: Auth) ──→ Phase 4 (US3: Session) ─┐
Phase 2 (Foundational)    ─┘                                                     │
                                                                                  ├─→ Phase 7 (Polish)
                            ┌─→ Phase 5 (US2: Sync) ────────────────────────────┤
Phase 3 (US1: Auth) ───────┤                                                     │
                            └─→ Phase 6 (US4: Abuse) ──────────────────────────┘
                                                                                  │
                                                                                  ▼
                                                                           Phase 8 (Testing)
```

- **Phase 1 + Phase 2**: Setup and Foundational run sequentially (Phase 2 depends on Phase 1 scaffold)
- **Phase 3 (US1)**: Depends on Phase 2. BLOCKS all other user stories.
- **Phase 4 (US3)**: Depends on Phase 3 (needs auth). Independent of US2.
- **Phase 5 (US2)**: Depends on Phase 3 (needs auth + device registration). Independent of US3.
- **Phase 6 (US4)**: Depends on Phase 3 (needs auth middleware). Can overlap with US2 (different files).
- **Phase 7 (Polish)**: Depends on Phases 3-6 (needs all stories for integration).
- **Phase 8 (Testing)**: Depends on Phase 7 (needs fully integrated app).

### User Story Dependencies

- **US1 (P1)**: Foundation only. No dependency on other stories.
- **US3 (P2)**: Depends on US1 (auth state). Independent of US2 and US4.
- **US2 (P2)**: Depends on US1 (auth, device registration). Independent of US3 and US4.
- **US4 (P3)**: Depends on US1 (auth middleware). Can overlap with US2 (different middleware files).

### Task-Level Dependencies

| Task | Depends on | Reason |
|------|-----------|--------|
| T001 | — | No dependencies |
| T002-T004 | — | Parallel, no dependencies |
| T005-T006 | — | Manual, can start anytime |
| T007 | T001, T006 | Worker scaffold + D1 database must exist |
| T008-T010 | T001 | Worker scaffold must exist |
| T011-T014 | T001 | Parallel client-side setup |
| T015-T020 | T002, T005, T013-T014 | Auth0 SDK + Dexie v2 + types ready |
| T021-T023 | T007-T009, T012 | Server infra + queries ready |
| T024-T028 | T015-T020 | Auth integration must be complete |
| T029-T032 | T007-T009, T012 | Server infra + queries ready |
| T033-T043 | T029-T030, T013-T014 | Sync API + Dexie v2 must exist |
| T044-T047 | T008-T009 | Hono + auth middleware must exist |
| T048-T053 | T033-T043 | Sync engine must be complete |
| T053a-T053b | T015-T020, T033-T043 | Auth + sync must exist for error boundaries |
| T054-T063 | T048-T053b | All features must be integrated |
| T060a | T054-T060 | Needs working sync + tests for measurement |
| T064 | T052 | CI deploy job must exist with worker-typecheck gate |

### Parallel Opportunities

```text
# Phase 1: All setup tasks after T001 are parallel
T002 (auth0 SDK) ‖ T003 (types) ‖ T004 (.env)

# Phase 2: Server and client foundational work is partially parallel
T008 (Hono entry) ‖ T009 (JWT middleware) ‖ T010 (CORS) — server
T013 (Dexie v2) ‖ T014 (types update) — client

# Phase 4: Session management tasks
T024 (AccountMenu) ‖ T025 (lock button) — different components

# Phase 5: Server and client sync work can partially overlap
T029-T032 (server endpoints) ‖ T033-T034 (client middleware + API client)

# Phase 6: Abuse protection tasks
T044 (rate limiting) ‖ T045 (validation) — different middleware files

# Phase 7: Polish tasks
T050 (account deletion) ‖ T051 (data export) — independent features

# Phase 8: Unit tests are all parallel
T054 (sync engine) ‖ T055 (middleware) ‖ T056 (encryption) — different test files

# CI/CD: Worker deployment pipeline
T064 (Worker CI deploy) — independent of test tasks, depends only on T052
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T014) — includes MANUAL pause for Auth0 + Cloudflare setup
3. Complete Phase 3: US1 — Authentication (T015-T023)
4. **STOP and VALIDATE**: Users can create accounts, log in, log out. App is gated behind auth.
5. Deploy to production for early validation.

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 (Auth) → Test independently → Deploy (MVP!)
3. Add US3 (Session) → Test lock/logout → Deploy
4. Add US2 (Sync) → Test multi-device → Deploy
5. Add US4 (Abuse Protection) → Test rate limiting → Deploy
6. Migration + Polish + Tests → Full verification → Deploy final release

### Optimal Execution (Single Developer)

```text
T001 → T002 ‖ T003 ‖ T004 → T005/T006 (manual)
  → T007 ‖ T008 ‖ T009 ‖ T010 ‖ T011 ‖ T012 ‖ T013 ‖ T014
  → T015-T023 (US1, sequential)
  → T024 ‖ T025, then T026-T028 (US3)
  → T029-T032 (server) → T033-T043 (client sync)
  → T044 ‖ T045, then T047 (US4; T046 descoped)
  → T048-T053 (polish)
  → T054 ‖ T055 ‖ T056 ‖ T064 (tests + CI deploy pipeline)
  → T057-T063 (contract/integration/e2e tests + verification)
```

---

## Notes

- T005 and T006 are **MANUAL** — the developer must complete Auth0 and Cloudflare setup before code implementation can proceed to Phase 3.
- The Worker has its own `package.json` and `tsconfig.json` — it is a separate project within the monorepo. Install Worker dependencies separately: `cd workers/sync-api && npm install`.
- The Dexie v2 migration (T013) MUST include an upgrade handler that preserves existing v1 data. Test the migration with a populated v1 database.
- The sync engine (T035) uses a separate encryption module (`src/services/syncCrypto.ts`) from the existing field-level crypto (`src/services/crypto.ts`). See [quickstart.md § A3](./quickstart.md#a3-sync-encryption-pipeline-t035-t056) for why these are separate concerns.
- Dexie middleware registration order is critical — sync tracking must be registered BEFORE encryption. See [quickstart.md § A1](./quickstart.md#a1-dexie-middleware-ordering-t013-t033).
- Cross-tab coordination (T037) requires feature detection for Web Locks API (95% browser support). Fallback to localStorage heartbeat for unsupported browsers.
- E2E auth testing (T059) is complex because Auth0 uses redirect-based flow. Consider using Auth0's test credentials, a test tenant, or mocking the Auth0 provider for E2E tests.
- The `rate_limits` D1 table in data-model.md is a fallback design only. Use Cloudflare's built-in binding (T044) as the primary strategy. See [quickstart.md § A5](./quickstart.md#a5-rate-limiting-strategy-t007-t044).
- Error boundary components (T053a, T053b) satisfy Constitution Principle V — auth and sync failures must degrade gracefully without crashing the app or blocking offline usage.
- Performance validation (T060a) covers SC-005 (sync < 2s), SC-006 (rejection < 100ms), and SC-008 (lock/logout < 2s) — the success criteria with no other dedicated test tasks.
- Worker deployment is automated via CI (T064). On merge to main, the deploy job runs D1 migrations, deploys the Worker, runs a health check, then deploys Pages. Failure at any step after Worker deploy triggers `wrangler rollback`. D1 migrations are intentionally NOT rolled back (additive, idempotent DDL). See [plan.md § Deployment Pipeline](./plan.md#deployment-pipeline) for the full failure matrix.
- T062 (initial Worker deploy) is still required for the first deployment and secret configuration. After that, CI handles all subsequent deploys.
- The total code delta spans: ~22 new files in `src/`, ~15 new files in `workers/sync-api/`, ~10 new test files, plus modifications to ~8 existing files.
