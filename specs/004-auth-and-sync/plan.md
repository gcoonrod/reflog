# Implementation Plan: Authentication & Cross-Device Sync

**Branch**: `004-auth-and-sync` | **Date**: 2026-02-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-auth-and-sync/spec.md`

## Summary

Add user authentication (Auth0), end-to-end encrypted cross-device sync (Cloudflare Workers + D1), and enhanced session management (lock/logout) to the Reflog PWA. The sync server operates as a zero-knowledge encrypted blob store — all encryption/decryption happens client-side using the existing vault passphrase. Account credentials (Auth0) are independent from vault encryption (PBKDF2-SHA256 → AES-256-GCM). Monthly hosting cost target: ≤$5 for 1,000 users.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`) — both client and Worker
**Primary Dependencies**: `@auth0/auth0-react` v2.15.0, Hono v4.x, `jose` v6.x, Dexie.js v4.3
**Storage**: Client: IndexedDB via Dexie.js (existing) | Server: Cloudflare D1 (SQLite on edge)
**Testing**: Vitest (unit + contract), Playwright (E2E), Miniflare (Worker integration)
**Target Platform**: PWA (all modern browsers) + Cloudflare Workers (edge compute)
**Project Type**: Web application — existing PWA frontend + new Worker backend
**Performance Goals**: Sync < 2s on broadband (SC-005), API rejection < 100ms (SC-006)
**Constraints**: E2E encryption (zero-knowledge server), ≤$5/month hosting (SC-004), offline-first preserved
**Scale/Scope**: 1,000 MAU, up to 10,000 entries per account, 5+ devices per user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Privacy-First, Device-Encrypted Data | PASS | All user content encrypted on-device (AES-256-GCM). Server stores only ciphertext. Zero-knowledge architecture. Metadata minimized to operational necessity (IDs, timestamps, record types). Constitution amended to v2.0.0 to reflect this architecture. |
| II. Offline-First PWA | PASS | PWA remains fully functional offline. Sync is an enhancement — all CRUD operations work without connectivity. Changes queue locally and sync when online. |
| III. Developer-Centric Minimalism | PASS | Lock button in header + account menu. Keyboard shortcut `Shift+Meta+L`. Sync indicator is a subtle header icon. No modal interruptions. |
| IV. Strict TypeScript & Modular Architecture | PASS | Strict TypeScript in both client and Worker. New modules follow existing patterns (hooks, services, components). Worker uses Hono with typed middleware. |
| V. Robust Error Boundaries | PASS | Sync failures degrade gracefully — app remains usable offline. Error boundaries for auth failures, sync errors, quota exceeded. User always informed of state. |
| VI. Git Flow & Commit Discipline | PASS | Feature branch from develop, PRs, quality gate enforced. Worker tests included in CI. |
| Architecture Boundaries | PASS | Server stack (Cloudflare Workers, D1, Auth0, Hono, jose) is now part of the binding tech stack per constitution v2.0.0. Server operates under zero-knowledge constraint — only handles ciphertext. |

**Gate result**: PASS — all principles satisfied. Constitution v2.0.0 (amended 2026-02-21) resolved the prior violations by redefining Principle I and Architecture Boundaries to permit zero-knowledge server components.

## Project Structure

### Documentation (this feature)

```text
specs/004-auth-and-sync/
├── plan.md              # This file
├── research.md          # Phase 0: technology research
├── data-model.md        # Phase 1: client + server schemas
├── quickstart.md        # Phase 1: implementation guide
├── contracts/
│   └── sync-api.yaml    # Phase 1: OpenAPI 3.0 spec for sync API
└── tasks.md             # Phase 2: implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/                              # Client (PWA) — existing, modified
├── components/
│   ├── auth/                     # New: AuthGuard, AuthErrorBoundary, LoginButton, AccountMenu
│   ├── sync/                     # New: SyncIndicator, SyncErrorBoundary, SyncStatus
│   ├── vault/                    # Existing: modified for auth integration
│   └── ...                       # Existing: unchanged
├── db/
│   ├── schema.ts                 # Modified: v2 migration (sync_queue, sync_meta)
│   ├── middleware.ts             # New: Dexie DBCore middleware for change tracking
│   └── ...                       # Existing: unchanged
├── hooks/
│   ├── useAuth.ts                # New: typed Auth0 wrapper
│   ├── useSyncStatus.ts          # New: sync state for UI indicator
│   ├── useVault.ts               # Modified: integrate with auth state
│   └── ...                       # Existing: unchanged
├── routes/
│   ├── __root.tsx                # Modified: add Auth0Provider, AccountMenu, SyncIndicator
│   ├── login.tsx                 # New: login/signup route
│   ├── migrate.tsx               # New: MVP → account migration route
│   └── ...                       # Existing: protected behind auth
├── services/
│   ├── auth.ts                   # New: Auth0 service layer
│   ├── sync.ts                   # New: sync engine (push, pull, conflict resolution)
│   ├── syncApi.ts                # New: HTTP client for sync API
│   └── ...                       # Existing: unchanged
├── types/
│   └── index.ts                  # Modified: add sync-related types
└── utils/
    └── ...                       # Existing: unchanged

workers/                          # New: Cloudflare Worker (sync API)
└── sync-api/
    ├── src/
    │   ├── index.ts              # Hono app entry point
    │   ├── routes/
    │   │   ├── sync.ts           # POST /sync/push, GET /sync/pull
    │   │   ├── account.ts        # DELETE /account, GET /account/usage, GET /account/export
    │   │   ├── devices.ts        # POST /devices/register, DELETE /devices/:id
    │   │   └── health.ts         # GET /health
    │   ├── middleware/
    │   │   ├── auth.ts           # JWT verification via jose + Auth0 JWKS
    │   │   ├── rateLimit.ts      # Rate limiting (Cloudflare built-in binding)
    │   │   └── cors.ts           # CORS configuration
    │   └── db/
    │       ├── schema.sql        # D1 table definitions
    │       └── queries.ts        # Prepared statement builders
    ├── wrangler.toml             # Worker configuration + D1 binding
    ├── tsconfig.json             # Worker-specific TS config
    ├── package.json              # Worker dependencies (hono, jose)
    └── vitest.config.ts          # Worker test config (Miniflare)

tests/                            # Existing test directory, extended
├── contract/                     # New: API contract tests
├── integration/                  # New: sync integration tests
├── unit/                         # Existing + new unit tests
└── e2e/                          # Existing Playwright tests, extended
```

**Structure Decision**: Hybrid — the existing `src/` PWA is extended in place (no restructuring), and a new `workers/sync-api/` directory is added at the repository root for the Cloudflare Worker. This keeps the two deployment targets (Cloudflare Pages for PWA, Cloudflare Workers for API) independent. The Worker has its own `package.json` and `tsconfig.json` to avoid polluting the PWA's dependency tree. Shared TypeScript types (e.g., `SyncRecord`) can be defined in `src/types/` and imported by both.

## Complexity Tracking

> **Historical context**: The original constitution v1.x had two principles that conflicted with this feature. Both were resolved by the v2.0.0 amendment (2026-02-21), which redefined Principle I from "Local-Only Data" to "Device-Encrypted Data" and expanded Architecture Boundaries to permit zero-knowledge server components. The trade-off rationale below is preserved for the design record.

| Design Trade-off | Why Chosen | Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Server-relayed sync (vs local-only) | User explicitly requested cross-device sync. Data must traverse a server to reach other devices. Zero-knowledge constraint (constitution v2.0.0 Principle I) ensures server never sees plaintext. | Local-only with manual export/import was considered — rejected because it doesn't meet the "seamless multi-device access" requirement (SC-001: setup second device in 5 minutes). |
| Cloudflare Worker backend (vs P2P) | Sync requires a server to relay encrypted blobs between devices. Worker operates under zero-knowledge constraint per constitution v2.0.0 Architecture Boundaries. | P2P sync (WebRTC) was considered — rejected because it requires both devices online simultaneously, doesn't support offline-to-online scenarios, and has NAT traversal complexity. A lightweight Worker is simpler and more reliable. |

## Spec Requirements Mapping

| Requirement | Implementation | Artifact |
|------------|----------------|----------|
| FR-001, FR-002, FR-004, FR-005 | Auth0 Universal Login + managed brute-force protection | [research.md R1](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) |
| FR-003 | Credential separation: Auth0 for identity, vault passphrase for encryption | [research.md R1](./research.md#r1-auth0-spa-integration-for-react-19--tanstack-start) |
| FR-005a | Migration route (`/migrate`), preserves local data, requires account creation | [quickstart.md Phase 7](./quickstart.md#phase-7-migration--polish-tasksmd-t048t053) |
| FR-006 | Lock button (header + account menu) + `Shift+Meta+L` shortcut | Client: `components/auth/AccountMenu`, `hooks/useKeyboard.ts` |
| FR-007 | Logout with keep/clear data choice | Client: `services/auth.ts`, `components/auth/AccountMenu` |
| FR-008 | Existing auto-lock preserved | No change to `useAutoLock.ts` |
| FR-009–FR-014 | Sync engine + Worker API | [data-model.md](./data-model.md), [contracts/sync-api.yaml](./contracts/sync-api.yaml) |
| FR-014a | Sync status indicator in header | Client: `components/sync/SyncIndicator` |
| FR-015–FR-018 | Rate limiting middleware + request validation | Worker: `middleware/rateLimit.ts`, [research.md R2](./research.md#r2-cloudflare-workers--d1-for-sync-api-backend) |
| FR-019 | Account deletion endpoint | Worker: `DELETE /account`, [contracts/sync-api.yaml](./contracts/sync-api.yaml) |
| FR-020 | Data export endpoint | Worker: `GET /account/export`, [contracts/sync-api.yaml](./contracts/sync-api.yaml) |
| SC-004 | $5/month Cloudflare Workers Paid + Auth0 Free | [research.md R5](./research.md#r5-auth0-free-tier--combined-cost-analysis) |

## Deployment Pipeline

The CI workflow at `.github/workflows/ci.yml` handles both PR quality gates and production deployment. On merge to main, after all CI jobs pass (lint, typecheck, format-check, unit-tests, e2e-tests, worker-typecheck, dependency-audit), the `deploy` job runs:

```text
Version guard → Changelog guard → Build → D1 migrations → Worker deploy → Health check → Pages deploy → Git tag
```

### Deployment Order Rationale

The Worker (backend) deploys before Pages (frontend):
- **Old UI + New API**: The existing UI in production tolerates a new backwards-compatible API
- **New UI + Old API**: A new UI deployed before its API could call endpoints that don't exist, causing user-facing errors

### Failure Matrix

| Scenario | Action | Production State |
|----------|--------|-----------------|
| D1 migration fails | Stop | Unchanged |
| Worker deploy fails | Stop | Unchanged (old Worker still live) |
| Health check fails | `wrangler rollback` Worker | Restored |
| Pages deploy fails | `wrangler rollback` Worker | Restored (old Pages still live) |
| All succeed | Tag + summarize | Updated |

### Rollback Mechanics

- `wrangler rollback --name=reflog-sync-api --yes` rolls back to the immediately previous Worker version
- Pages never needs explicit rollback — a failed `pages deploy` leaves the previous deployment active
- **D1 migrations are NOT rolled back**: All DDL is additive and idempotent (`CREATE IF NOT EXISTS`). Old Worker code ignores new tables/columns. Breaking schema changes require a separate multi-phase migration strategy.

### Worker Configuration (`wrangler.toml`)

The Worker configuration includes:
- **D1 binding**: `reflog-sync` database bound as `DB`
- **Rate limiting**: Two Cloudflare Rate Limiting bindings (`RATE_LIMITER_IP` at 100 req/60s, `RATE_LIMITER_USER` at 200 req/60s)
- **Observability**: Worker logs enabled via `[observability.logs]` with `enabled = true` and `invocation_logs = true`
- **Cron triggers**: Tombstone GC runs daily at 3 AM UTC via `[triggers] crons`
- **Auth0 vars**: `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` set in `[vars]`

### Health Check

The Worker health check (5 retries, 5s delay) calls `GET /api/v1/health` which verifies D1 connectivity via `SELECT 1` ([`workers/sync-api/src/routes/health.ts`](../../workers/sync-api/src/routes/health.ts)). This catches deployment issues (misconfigured bindings, runtime errors) before the frontend is updated.
