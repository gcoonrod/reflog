# Research: Beta Readiness

**Branch**: `005-beta-readiness` | **Date**: 2026-02-23

## R1. Monorepo Structure with Yarn Classic Workspaces

**Decision**: Adopt Yarn v1.x workspaces with four packages: `packages/web` (PWA), `packages/sync-api` (Worker), `packages/cli` (operator CLI), and `packages/shared` (shared types/contracts).

**Rationale**: The repo already has two conceptual projects (root UI app + `workers/sync-api/` Worker) with separate `package.json` and `yarn.lock` files. Adding a CLI tool would make three. Yarn workspaces unify dependency management under a single lockfile, enable cross-package imports via `@reflog/shared`, and deduplicate devDependencies.

**Key decisions**:
- Root `package.json` declares `"workspaces": { "packages": ["packages/*"], "nohoist": [...] }`
- `nohoist` for `wrangler`, `@cloudflare/workers-types`, and `@cloudflare/vitest-pool-workers` to prevent type conflicts between Vite and Cloudflare globals
- Each package has its own `package.json`, `tsconfig.json`, and build scripts
- Root-level config files (ESLint, Prettier, PostCSS) apply to all packages
- Tests stay at root level (`tests/`) for UI unit/integration/contract/E2E tests; Worker tests stay in `packages/sync-api/tests/`
- A single `yarn.lock` at root replaces the current two separate lockfiles

**Alternatives considered**:
- Yarn Berry (v2+): Project committed to Yarn Classic per CLAUDE.md
- npm workspaces: Would require switching package manager
- Turborepo/Nx: Overkill for 4 packages; `yarn workspaces run` suffices
- No workspaces: Two-lockfile approach already causes CI friction; adding CLI makes three

## R2. Cloudflare Pages Preview Deployments

**Decision**: Deploy a stable preview environment that tracks the `develop` branch. The preview Worker (`reflog-sync-api-preview`) deploys via `wrangler deploy --env preview` with a dedicated D1 preview database. Cloudflare Pages deploys the frontend from the `develop` branch to a stable URL (`develop.reflog.pages.dev`).

**Rationale**: For a solo developer, per-PR previews add complexity without proportional benefit — there's only one active development stream at a time. A develop-tracking preview provides a stable staging URL that mirrors the next production state, simplifies Auth0 callback configuration (one stable URL instead of wildcard patterns), and is easier to share for demos.

**Key decisions**:
- Add `[env.preview]` section to `wrangler.toml` with separate D1 binding (`reflog-sync-preview`)
- Preview Worker name: `reflog-sync-api-preview`
- One persistent preview D1 database — tracks develop, not individual PRs
- Preview frontend built with `VITE_SYNC_API_URL` pointing to preview Worker
- CI `preview-deploy` job runs on push to `develop` branch (after lint/typecheck/tests pass)
- Preview is overwritten in-place on each develop push; no teardown logic needed

**Alternatives considered**:
- Per-PR previews: Adds complexity (wildcard Auth0 callbacks, multiple preview URLs); unnecessary for solo developer
- Pages Functions instead of separate Worker: Loses cron triggers and rate limiter bindings
- Per-PR D1 databases: Adds cleanup complexity; single shared DB is simpler
- Skip preview Workers: Frontend-only previews can't test sync features

## R3. Auth0 Invite-Only Signup

**Decision**: Disable public signup in Auth0 Dashboard + use Management API from CLI tool to create accounts. Add a pre-user-registration Action as a safety net.

**Rationale**: Simplest approach that works within Auth0 free tier (7,500 MAU). Disabling the signup toggle removes the signup button from Auth0 Universal Login. The CLI tool calls the Management API to create user accounts and trigger password-reset emails. A pre-user-registration Action denies any signup that bypasses the disabled UI.

**Invite flow**:
1. Operator runs `reflog-cli invite create user@example.com`
2. CLI calls Auth0 Management API `POST /api/v2/users` to create account
3. CLI calls `POST /dbconnections/change_password` to trigger "set your password" email
4. CLI records invite token + email in D1 `invites` table
5. User receives email, sets password, logs in
6. On first login, sync-api middleware checks `invites` table, marks invite as consumed

**Alternatives considered**:
- Auth0 Actions with invite token: More complex, requires custom UI and external token store
- Auth0 Organizations: Not available on free tier
- Custom pre-registration hook with allowlist: Requires maintaining list in Actions secrets or D1; Management API + disabled signup is simpler

## R4. Auth0 Separate Environments

**Decision**: Two separate Auth0 tenants — `reflog-dev` (Development tag) for preview/local and the existing production tenant for production.

**Rationale**: Auth0 recommends separate tenants for environment isolation. Dev/preview users don't pollute production user database. Preview callback URLs (wildcard `*.pages.dev`) stay off the production tenant, preventing open redirect attacks. Free tier allows multiple tenants with independent 7,500 MAU quotas.

**Configuration**:
| Setting | Dev Tenant | Production Tenant |
|---------|-----------|-------------------|
| Callback URLs | `localhost:3000`, `develop.reflog.pages.dev` | `reflog.microcode.io` |
| API Audience | `sync-preview.reflog.microcode.io` | `sync.reflog.microcode.io` |
| Signup | Disabled (same as prod) | Disabled |

**Alternatives considered**:
- Single tenant, different Applications: Shares user database and Action pipeline; preview bugs affect production
- Environment tags only: Tags are metadata on tenants, not isolation boundaries

## R5. Payment Processors for PWA ($4.99/month)

**Decision**: Use Lemon Squeezy as Merchant of Record. Defer implementation to post-beta; this decision informs the research deliverable only.

**Rationale**: At $4.99/month, the fee comparison is:

| Processor | Fee on $4.99/mo | Rate | Fee on $50/yr | Rate | MoR (handles tax) |
|-----------|-----------------|------|---------------|------|--------------------|
| Stripe | $0.44 | 8.9% | $1.75 | 3.5% | No |
| Lemon Squeezy | $0.75 | 15.0% | $3.00 | 6.0% | Yes |
| Paddle | $0.75 | 15.0% | $3.00 | 6.0% | Yes |
| Gumroad | $0.50 | 10.0% | $5.00 | 10.0% | Yes |

Lemon Squeezy wins for a solo developer because:
1. Merchant of Record eliminates all sales tax/VAT filing — critical for a solo developer
2. Embedded overlay checkout (no redirect away from domain)
3. Webhook support compatible with Cloudflare Workers (HMAC verification)
4. No monthly fees — pay nothing until you have paying customers
5. The ~6% fee premium over Stripe buys complete tax compliance
6. At scale (>$10K MRR), revisit switching to Stripe + tax service

**Alternatives considered**:
- Stripe: Lowest fees but requires handling tax compliance across jurisdictions
- Paddle: Same fees as Lemon Squeezy, more enterprise-focused
- Gumroad: Highest fees, no embedded checkout, limited webhook API

## R6. Cloudflare D1 Backups

**Decision**: Rely on D1 Time Travel (point-in-time recovery) as primary backup. Supplement with pre-migration manual snapshots.

**Rationale**: Time Travel is always-on, free, and provides per-minute granularity. Free tier: 7-day retention. Workers Paid ($5/month): 30-day retention. No configuration needed.

**Backup strategy**:
1. Time Travel handles accidental data loss and bad migrations (7-day window on free tier)
2. Pre-migration manual snapshot: `wrangler d1 backup create reflog-sync` before each schema migration
3. Weekly local download: `wrangler d1 backup download` for offline SQLite copy
4. Upgrade to Workers Paid ($5/month) when accepting paying users for 30-day retention

**Alternatives considered**:
- Manual-only backups: Time Travel is automatic and more granular
- Third-party backup service: D1 built-in is sufficient
- Workers Paid immediately: Free tier's 7-day window is adequate for <50 beta users

## R8. Cloudflare Pages Functions vs. Standalone Worker

**Decision**: Keep the sync API as a standalone Cloudflare Worker. Do not migrate to Pages Functions.

**Rationale**: Pages Functions (the `/functions` directory approach) bundle API endpoints into the same Pages deployment as the static frontend. This would simplify preview deployments (every PR preview automatically includes the API). However, two critical features used by the sync API are **not supported** in Pages Functions:

1. **Rate Limiting bindings**: The `[[ratelimits]]` binding is not listed as a supported Pages Functions binding. The sync API uses two rate limiters (IP-based at 100 req/min, user-based at 200 req/min). Removing them is a security regression; reimplementing via D1 or KV adds latency and complexity.

2. **Cron Triggers**: Pages Functions do not support `[triggers] crons`. The daily tombstone garbage collection (`0 3 * * *`) depends on this. Workarounds (external cron, lazy GC on requests) add operational complexity.

**What Pages Functions DO support**:
- D1 bindings (full support, including preview-specific databases via `[env.preview]`)
- KV, R2, Durable Objects, Vectorize, Workers AI, Service Bindings, Queue Producers
- File-based routing or Advanced Mode (embed Hono via `_worker.ts`)
- Middleware via `_middleware.ts` files at directory level
- Automatic preview deployments for PR branches (the strongest argument for migration)

**Why this matters for preview environments**: The plan's preview environment (R2) requires a separate CI job to deploy the preview Worker alongside Pages previews. If Pages Functions supported all bindings, this entire job could be eliminated — the PR preview URL would automatically include both frontend and API. This is the trade-off: operational simplicity of one deployment target vs. feature completeness of a standalone Worker.

**When to revisit**:
- If Cloudflare adds Rate Limiting support to Pages Functions
- If Cloudflare adds Cron Trigger support (or Pages-equivalent scheduled functions)
- If a separate "GC Worker" pattern (tiny Worker for cron only) proves more maintainable than the current monolithic Worker

**Alternatives considered**:
- Pages Functions (file-based): Loses rate limiting and cron; requires rewriting Hono middleware
- Pages Functions Advanced Mode (embed Hono): Easier migration but still loses rate limiting and cron
- Hybrid (Pages Functions for API + separate Worker for cron): Doesn't solve rate limiting; adds fragmented deployment
- Keep standalone Worker: Retains all features; preview environment requires CI orchestration but is already planned

## R7. Current Codebase Gap Analysis

**Audit findings** (from automated codebase exploration):

| Aspect | Status | Gap |
|--------|--------|-----|
| CI/CD Pipeline | Production-only | No preview/staging deployment |
| Authentication | Open registration | No invite gate, no waitlist |
| Payment/Billing | Missing | No payment infrastructure |
| Observability | Minimal | Worker logs only; no alerting, metrics, or error tracking |
| Rate Limiting | Complete | IP-based (100/min) + user-based (200/min) |
| Database Backups | Available | D1 Time Travel enabled but no documented recovery procedure |
| Legal Pages | Missing | No ToS or privacy policy |
| Onboarding | Partial | Vault setup exists but no landing page for new/uninvited visitors |
| Repo Structure | Flat | Two separate package.json/yarn.lock files; no workspace coordination |

**Severity classification**:
- **Critical** (must fix before beta): Invite system, legal pages, preview environment
- **Important** (within first month): Observability/alerting, backup documentation, monorepo restructure
- **Nice-to-Have** (can defer): Analytics, i18n, native app
