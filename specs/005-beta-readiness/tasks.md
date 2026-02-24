# Tasks: Beta Readiness

**Input**: Design documents from `/specs/005-beta-readiness/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Stories 3–6 are research deliverables (documents, not code).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions
- **Ref**: Points to source document sections for implementation details

## Path Conventions

- **Monorepo**: `packages/web/`, `packages/sync-api/`, `packages/cli/`, `packages/shared/`
- **Root-level**: `tests/`, `specs/`, `.github/`, `playwright.config.ts`, `eslint.config.js`

## Reference Map

| Document | Key Section(s) | Consuming Tasks |
|----------|---------------|-----------------|
| research.md | §R1 Monorepo Structure | T001–T011, T017 |
| research.md | §R2 Preview Deployments | T039–T043 |
| research.md | §R3 Auth0 Invite-Only Signup | T019–T026, T027–T031, T036–T037 |
| research.md | §R4 Auth0 Separate Environments | T040 |
| research.md | §R5 Payment Processors | T045 |
| research.md | §R6 D1 Backups | T047 |
| research.md | §R7 Gap Analysis | T046 |
| research.md | §R8 Pages Functions Decision | T039 (rationale for standalone Worker) |
| data-model.md | Invite, Waitlist, BetaConfig tables | T013, T015, T016, T018 |
| quickstart.md | §A1 Monorepo Migration | T001–T011 |
| quickstart.md | §A2 Invite System Integration | T019–T038 |
| quickstart.md | §A3 Preview Environment | T039–T043 |
| quickstart.md | §A4 Legal Pages | T032–T035 |
| contracts/invite-api.md | All 4 endpoints + CLI-only operations | T027–T031 (API), T023–T025 (CLI) |
| contracts/legal-pages.md | ToS + Privacy Policy contracts | T032–T035 |
| plan.md | Project Structure tree | T001–T011 (monorepo layout), T012–T018 (foundational files) |

---

## Phase 1: Setup (Monorepo Migration)

**Purpose**: Restructure from flat layout to Yarn Classic workspaces with 4 packages. This is an atomic migration — all tasks in this phase must complete before moving on.

- [X] T001Create `packages/` directory structure: `packages/web/`, `packages/sync-api/`, `packages/shared/src/`, `packages/cli/src/`. Ref: quickstart.md §A1 step 1, plan.md Project Structure tree
- [X] T002 Move `src/` → `packages/web/src/` and relocate web config files (`vite.config.ts`, `vitest.config.ts`, `postcss.config.cjs`, `public/`) to `packages/web/`. Ref: quickstart.md §A1 step 1 (note: `playwright.config.ts` stays at root)
- [X] T003 Create `packages/web/package.json` with web app dependencies extracted from root `package.json` (TanStack, React, Mantine, Dexie, CodeMirror, MiniSearch, vite-plugin-pwa, auth0-react, react-markdown) and `packages/web/tsconfig.json` extending root. Ref: research.md §R1 (nohoist not needed for web deps), plan.md Project Structure tree (web package layout)
- [X] T004 Move `workers/sync-api/` → `packages/sync-api/`, delete its standalone `yarn.lock`, update `packages/sync-api/tsconfig.json` to extend root. Ref: quickstart.md §A1 step 2, research.md §R1 (single lockfile rationale)
- [X] T005 [P] Create `packages/shared/package.json` (name: `@reflog/shared`, no runtime deps), `packages/shared/tsconfig.json` extending root, and `packages/shared/src/index.ts` barrel export. Ref: quickstart.md §A1 cross-package imports example
- [X] T006 [P] Create `packages/cli/package.json` (name: `@reflog/cli`, deps: `commander`, `auth0`, `dotenv`; bin: `reflog-cli`), `packages/cli/tsconfig.json` extending root, and `packages/cli/src/index.ts` entry point scaffold. Ref: plan.md Project Structure tree (cli package layout)
- [X] T007 Update root `package.json`: set `private: true`, add `workspaces` config with `packages: ["packages/*"]` and `nohoist` for `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`; remove migrated web/worker deps (keep only shared devDeps: ESLint, Prettier, TypeScript). Ref: research.md §R1 (nohoist list and rationale), quickstart.md §A1 root config example
- [X] T008 Update root `tsconfig.json` as base config with `composite: true`; update `packages/web/tsconfig.json` path aliases (`@/*` → `packages/web/src/*`); update `packages/web/vite.config.ts` resolve alias. Ref: quickstart.md §A1 step 6 (import path updates)
- [X] T009 Update `playwright.config.ts` to reference `packages/web/` for webServer config; update `eslint.config.js` for monorepo paths; update `.prettierrc` ignore patterns if needed. Ref: quickstart.md §A1 step 1 (playwright stays at root)
- [X] T010 Delete `workers/` directory (now empty after move); run `yarn install` at root to generate unified lockfile; verify no duplicate lockfiles remain. Ref: quickstart.md §A1 step 7
- [X] T011 Verify typecheck, lint, tests, and build pass across all workspaces: `yarn workspaces run typecheck`, `yarn workspaces run lint`, `yarn workspaces run test`, `yarn workspaces run build`

**Checkpoint**: Monorepo structure is valid — all existing functionality works from new paths

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, database schema, CI updates, and D1 migration that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T012 Extract shared sync types from `packages/web/src/types/sync.ts` to `packages/shared/src/sync.ts`; update imports in `packages/web/` and `packages/sync-api/` to use `@reflog/shared`. Types to extract: `SyncRecord`, `PushRequest`, `PushResponse`, `PullResponse`, `DeviceRegistration`, `Device`, `AccountUsage`, `ExportResponse`, `QuotaExceededError`, `SyncStatus`. Ref: quickstart.md §A1 cross-package imports example
- [X] T013 [P] Create invite and beta shared types (`Invite`, `InviteStatus`, `WaitlistEntry`, `BetaConfig`, `InviteVerifyRequest`, `InviteVerifyResponse`, `InviteConsumeRequest`, `WaitlistJoinRequest`, `BetaStatusResponse`) in `packages/shared/src/invite.ts`. Ref: data-model.md (table definitions, field types, state transitions), contracts/invite-api.md (request/response shapes)
- [X] T014 Export all shared types from `packages/shared/src/index.ts` (re-export sync.ts and invite.ts)
- [X] T015 Add `invites`, `waitlist`, and `beta_config` tables with indexes to `packages/sync-api/src/db/schema.sql` per data-model.md; include `INSERT OR IGNORE` for `beta_config` initial rows (`max_beta_users: 50`, `invite_expiry_days: 30`). Ref: data-model.md (all 3 table schemas, indexes, validation rules)
- [X] T016 Add invite and waitlist DB query functions to `packages/sync-api/src/db/queries.ts`: `findInviteByEmail`, `findInviteByToken`, `consumeInvite`, `createWaitlistEntry`, `findWaitlistByEmail`, `getBetaConfig`, `countConsumedInvites`. Ref: data-model.md (state transitions, validation rules), contracts/invite-api.md (CLI-only operations section for query patterns)
- [X] T017 Update `.github/workflows/ci.yml` for monorepo: install at root with `yarn install --frozen-lockfile`, run lint/typecheck/test/build via `yarn workspace @reflog/web ...` and `yarn workspace @reflog/sync-api ...`; add `yarn workspace @reflog/shared typecheck` step. Ref: research.md §R1 (workspace coordination), existing CI in `.github/workflows/ci.yml`
- [X] T018 Execute D1 schema migration against remote production database: `wrangler d1 execute reflog-sync --remote --file=packages/sync-api/src/db/schema.sql`. All DDL uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE`, so this is idempotent. Ref: data-model.md (notes section — migration pattern), existing schema.sql for DDL patterns

**Checkpoint**: Foundation ready — shared types importable, D1 schema updated, CI green on monorepo structure

---

## Phase 3: User Story 1 — Invite-Only Beta Access (Priority: P1) MVP

**Goal**: Operator can generate invites via CLI, invited users can sign up, uninvited visitors see a landing page with waitlist. Legal pages (ToS + Privacy Policy) ship as a pre-requisite (FR-031).

**Independent Test**: Run `reflog-cli invite create test@example.com`, verify invite appears in D1. Log in as test@example.com, verify POST /invites/verify returns 200. Visit app without auth, verify landing page renders with waitlist form. Visit `/terms` and `/privacy`, verify static content renders.

### Auth0 Setup (Manual — Document Steps)

- [X] T019 [US1] Document Auth0 production setup steps in `specs/005-beta-readiness/deliverables/auth0-production-setup.md`: (1) disable public signup in Auth0 Dashboard → Authentication → Database → Settings, (2) create Machine-to-Machine application for CLI with Management API grants (`create:users`, `read:users`, `update:users`), (3) add pre-user-registration Action that denies all direct signups as safety net, (4) record client ID, client secret, domain, and API audience values. Ref: research.md §R3 (Auth0 setup steps, invite flow), quickstart.md §A2 (Auth0 setup list)

### CLI Package (`packages/cli/`)

- [X] T020 [US1] Create Auth0 Management API client in `packages/cli/src/lib/auth0.ts` — authenticate via M2M client credentials (client ID + secret from env), expose `createUser(email)` and `triggerPasswordReset(email)` methods. Ref: research.md §R3 (invite flow steps 2-3: POST /api/v2/users, POST /dbconnections/change_password)
- [X] T021 [US1] Create D1 database client in `packages/cli/src/lib/d1.ts` — spawn `wrangler d1 execute` as a subprocess for local CLI access to remote D1; expose `query(sql, params)` method that returns parsed JSON results. Ref: contracts/invite-api.md (CLI-only operations section — all CLI queries go through D1 directly, not HTTP)
- [X] T022 [US1] Create CLI environment configuration: add `.env.example` with required variables (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `D1_DATABASE_ID`); create `packages/cli/src/lib/config.ts` to load and validate env vars via `dotenv`. Ref: T019 output (Auth0 credential values)
- [X] T023 [P] [US1] Implement `invite` commands in `packages/cli/src/commands/invite.ts`: `invite create <email>` (creates Auth0 user + D1 invite + triggers password reset email), `invite list [--status pending|consumed|expired|revoked]` (MUST annotate or filter invites past `expires_at` as expired even if DB status is still `pending` — FR-005 lazy expiration), `invite revoke <email>` (sets status to revoked), `invite create --from-waitlist <email>` (marks waitlist entry as invited). Ref: research.md §R3 (6-step invite flow), contracts/invite-api.md (CLI-only operations), data-model.md (Invite state transitions, validation rules)
- [X] T024 [P] [US1] Implement `waitlist list` command in `packages/cli/src/commands/waitlist.ts`: list all waitlist entries sorted by created_at, display email, date, and invited status. Ref: contracts/invite-api.md (CLI-only operations — "View waitlist"), data-model.md (Waitlist Entry schema)
- [X] T025 [P] [US1] Implement `config` commands in `packages/cli/src/commands/config.ts`: `config get <key>` and `config set <key> <value>` against D1 `beta_config` table. Ref: contracts/invite-api.md (CLI-only operations — "Set beta config"), data-model.md (BetaConfig table, initial rows)
- [X] T026 [US1] Wire all commands into CLI entry point in `packages/cli/src/index.ts` using Commander.js; add `--env` flag for production/preview D1 target; add version from package.json. Ref: plan.md Project Structure tree (cli entry point)

### Sync API Routes (`packages/sync-api/`)

- [X] T027 [P] [US1] Implement invite verification middleware in `packages/sync-api/src/middleware/invite.ts` — on first request from authenticated user, check `invites` table for matching email; MUST use correct expiry logic: `(status = 'consumed') OR (status = 'pending' AND expires_at > now())` — consumed invites are permanently valid, only pending invites expire (FR-005: "expire **unused** invites"); if no valid invite, return 403; cache result to avoid per-request DB lookup. Ref: contracts/invite-api.md (POST /invites/verify response shapes), data-model.md (Invite state transitions — no transition out of `consumed`). Follow existing middleware pattern: `createMiddleware<{ Bindings: Env; Variables: {...} }>()` per `packages/sync-api/src/middleware/auth.ts`
- [X] T028 [P] [US1] Implement `POST /api/v1/invites/verify` and `POST /api/v1/invites/consume` in `packages/sync-api/src/routes/invites.ts` per contracts/invite-api.md (auth required, email from JWT); verify endpoint MUST treat **pending** invites past `expires_at` as invalid (FR-005: "expire unused invites"); consumed invites are permanently valid regardless of `expires_at`. Ref: contracts/invite-api.md (full request/response contracts for both endpoints), data-model.md (consumed_at, consumed_by_user_id fields set on consumption; state transitions — no transition out of `consumed`)
- [X] T029 [P] [US1] Implement `POST /api/v1/waitlist` in `packages/sync-api/src/routes/waitlist.ts` per contracts/invite-api.md (public, rate-limited 10 req/min per IP, requires consent=true). Ref: contracts/invite-api.md (POST /waitlist contract — 201, 409, 400 responses), data-model.md (Waitlist Entry schema, consent validation)
- [X] T030 [P] [US1] Implement `GET /api/v1/beta/status` in `packages/sync-api/src/routes/beta.ts` per contracts/invite-api.md (public, returns `accepting_signups` and `waitlist_open` booleans). Ref: contracts/invite-api.md (GET /beta/status — no user count exposure), data-model.md (BetaConfig `max_beta_users` key)
- [X] T031 [US1] Register invite, waitlist, and beta routes in `packages/sync-api/src/index.ts`; apply invite middleware to existing sync routes (POST /sync/push, POST /sync/pull). Ref: plan.md Project Structure tree (route file locations). Integration point: existing route registration uses `app.route("/api/v1/...", router)` pattern; invite middleware inserts AFTER auth + user middleware, BEFORE sync routes in the middleware chain: `cors → ipRateLimit → bodySize → contentType → [public: health, waitlist, beta/status] → auth → user → invite → userRateLimit → [protected: sync, invites, account, devices]`

### Legal Pages (`packages/web/`)

- [X] T032 [P] [US1] Write Terms of Service markdown content in `packages/web/src/content/terms.md` per contracts/legal-pages.md (acceptance, service description, user responsibilities, acceptable use, IP, liability, beta disclaimer, termination, changes, contact). Ref: contracts/legal-pages.md (ToS key sections list)
- [X] T033 [P] [US1] Write Privacy Policy markdown content in `packages/web/src/content/privacy.md` per contracts/legal-pages.md (data collected/purposes, data NOT collected, encryption/zero-knowledge, retention/deletion, user rights GDPR/CCPA, changes, contact). Ref: contracts/legal-pages.md (Privacy Policy key sections list, data categories)
- [X] T034 [P] [US1] Create `/terms` route component in `packages/web/src/routes/terms.tsx` — public route (outside `_app` layout), renders `terms.md` via `react-markdown`, includes navigation back to app. Ref: contracts/legal-pages.md (implementation notes — public route pattern). Follow existing public route pattern: `createFileRoute("/terms")` at same level as `_app.tsx` and `login.tsx` (NOT nested under `_app/`)
- [X] T035 [P] [US1] Create `/privacy` route component in `packages/web/src/routes/privacy.tsx` — public route (outside `_app` layout), renders `privacy.md` via `react-markdown`, includes navigation back to app. Ref: contracts/legal-pages.md (implementation notes). Same pattern as T034.

### Landing Page & Auth Gate (`packages/web/`)

- [X] T036 [US1] Create beta landing page at `packages/web/src/routes/landing.tsx` — public route for unauthenticated visitors; explain beta is invite-only; include waitlist signup form (email + privacy consent checkbox) that POSTs to `/api/v1/waitlist`; link to `/terms` and `/privacy`. Ref: quickstart.md §A2 (client-side gate flow), contracts/invite-api.md (POST /waitlist request shape, GET /beta/status for capacity check)
- [X] T037 [US1] Add invite verification gate to auth flow in `packages/web/src/components/auth/` — after Auth0 login, call `POST /api/v1/invites/verify`; if 403 `invite_required`, show "invite required" screen; if 403 `beta_full`, show "beta at capacity" with waitlist option; on first success, call `POST /api/v1/invites/consume`. Ref: quickstart.md §A2 (client-side gate flow diagram — 200/403 branching), contracts/invite-api.md (verify + consume response shapes). Integration point: gate runs inside `_app.tsx` layout AFTER AuthGuard but BEFORE VaultProvider in the component tree
- [X] T038 [US1] Add footer links to `/terms` and `/privacy` in the app layout component (`packages/web/src/routes/_app.tsx` or layout component); also add footer to landing page. Ref: contracts/legal-pages.md (implementation notes — footer link placement)

**Checkpoint**: Full invite flow works end-to-end — CLI creates invites, API verifies/consumes, uninvited users see landing page, legal pages accessible

---

## Phase 4: User Story 2 — Preview Environment (Priority: P2)

**Goal**: The `develop` branch deploys to a stable preview URL with separate D1 and Auth0 configuration. No production data is accessible from preview.

**Independent Test**: Merge a change to develop, verify CI deploys preview Worker and Pages at stable URL (`develop.reflog.pages.dev`). Visit the preview URL, verify it loads and authenticates against the dev Auth0 tenant. Verify sync operations hit the preview D1 database (not production).

- [X] T039 [US2] Add `[env.preview]` section to `packages/sync-api/wrangler.toml` with preview Worker name (`reflog-sync-api-preview`), preview D1 binding (`reflog-sync-preview`), and preview-specific environment variables. Ref: research.md §R2 (preview Worker config, D1 binding name), research.md §R8 (rationale for standalone Worker over Pages Functions)
- [X] T040 [US2] Document Auth0 dev tenant manual setup steps in `specs/005-beta-readiness/deliverables/auth0-preview-setup.md` — create `reflog-dev` tenant, configure callback URLs (`localhost:3000`, `develop.reflog.pages.dev`), create API audience (`sync-preview.reflog.microcode.io`), disable signup, create M2M app for CLI. Ref: research.md §R4 (dev vs prod tenant config table), research.md §R2 (preview Auth0 callback URL)
- [X] T041 [US2] Add `preview-deploy` job to `.github/workflows/ci.yml`: triggers on push to `develop` branch; runs after lint/typecheck/test pass; deploys preview Worker via `wrangler deploy --env preview`; builds frontend with preview env vars (`VITE_SYNC_API_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`); deploys to Pages via `wrangler pages deploy --branch=develop`. Ref: research.md §R2 (CI workflow steps), quickstart.md §A3 (preview-deploy job YAML structure)
- [X] T042 [US2] Add preview environment secrets to GitHub repository settings and document required secrets in `.env.example`: `CLOUDFLARE_API_TOKEN`, `VITE_AUTH0_DOMAIN_PREVIEW`, `VITE_AUTH0_CLIENT_ID_PREVIEW`, `VITE_AUTH0_AUDIENCE_PREVIEW`, `VITE_SYNC_API_URL_PREVIEW`
- [X] T043 [US2] Provision D1 preview database: run `wrangler d1 create reflog-sync-preview`, record the database ID, update `packages/sync-api/wrangler.toml` `[env.preview]` with the actual database ID, then execute schema migration against preview: `wrangler d1 execute reflog-sync-preview --remote --file=packages/sync-api/src/db/schema.sql`. Ref: research.md §R2 (persistent preview D1 database), data-model.md (notes — preview uses identical schema)

**Checkpoint**: Develop branch deploys produce a stable preview at `develop.reflog.pages.dev` with isolated data stores and auth

---

## Phase 5: User Story 3 — Pricing Model and Free-Tier Design (Priority: P3)

**Goal**: Document a pricing model with concrete tier definitions validated against user feedback.

**Independent Test**: Pricing document exists with free tier (25 MB, 2 devices) and paid tier ($4.99/mo or $50/yr) clearly defined. At least 5 potential users can articulate the value difference (SC-005).

- [X] T044 [US3] Write pricing model document in `specs/005-beta-readiness/deliverables/pricing-model.md` — include tier comparison table (Free: 25 MB storage / 2 devices, Pro: expanded limits at $4.99/mo or $50/yr with ~16% annual discount), free-tier value justification (core journaling + limited sync), upgrade triggers (storage and device limits), user validation plan (5+ testers, 80% comprehension target per SC-005), cost projection at 50 users. Ref: spec.md FR-017–FR-021 (pricing tier requirements), spec.md SC-005 (comprehension success criterion)

---

## Phase 6: User Story 4 — Payment Processing Research (Priority: P4)

**Goal**: Evaluate payment processors for PWA context and recommend one for post-beta implementation.

**Independent Test**: Comparison document exists with at least 3 processors evaluated. Recommendation includes fee analysis at both $4.99/mo and $50/yr price points.

- [X] T045 [US4] Write payment processor comparison in `specs/005-beta-readiness/deliverables/payment-processors.md` — evaluate Stripe, Lemon Squeezy, Paddle, Gumroad against: fee on $4.99/mo and $50/yr, Merchant of Record status, embedded/overlay checkout for PWA, webhook compatibility with Cloudflare Workers, sandbox testing support; recommend Lemon Squeezy per research.md §R5; include decision matrix and migration path to Stripe at scale. Ref: research.md §R5 (fee comparison table, Lemon Squeezy rationale), spec.md SC-006 (fee threshold: under 10% monthly / under 5% annual)

---

## Phase 7: User Story 5 — Gap Analysis and Operational Readiness (Priority: P5)

**Goal**: Produce a categorized gap analysis covering all 5 required areas (FR-022) and a documented backup procedure.

**Independent Test**: Gap analysis covers observability, backups, abuse prevention, legal/privacy, and onboarding (SC-007). Total projected cost <$10/mo confirmed. Backup procedure is step-by-step executable.

- [X] T046 [P] [US5] Write gap analysis report in `specs/005-beta-readiness/deliverables/gap-analysis.md` — audit current deployment against 5 categories (observability, backups, abuse prevention, legal/privacy, onboarding per FR-022); classify each gap as Critical/Important/Nice-to-Have per research.md §R7; include cost estimate per gap and confirm total <$10/mo for beta (SC-002, SC-007). Ref: research.md §R7 (audit findings table, severity classification)
- [X] T047 [P] [US5] Write D1 backup and recovery procedure in `specs/005-beta-readiness/deliverables/backup-procedure.md` — document Time Travel usage (7-day free tier), pre-migration snapshot steps (`wrangler d1 backup create`), weekly local download, point-in-time recovery workflow, and upgrade path to Workers Paid per research.md §R6. Ref: research.md §R6 (backup strategy, 4-tier approach)

**Checkpoint**: Operational readiness documented — all gaps categorized, backup procedure executable

---

## Phase 8: User Story 6 — Future Feature Roadmap (Priority: P6)

**Goal**: Speculative roadmap with competitive analysis and at least 3 differentiating feature proposals.

**Independent Test**: Roadmap includes comparison matrix against Obsidian, Notion, and Standard Notes (FR-025). At least 3 unique features proposed with complexity and impact ratings (SC-008).

- [X] T048 [US6] Write competitive analysis and future feature roadmap in `specs/005-beta-readiness/deliverables/roadmap.md` — compare Reflog against Obsidian, Notion, Bear, Standard Notes on: encryption, offline-first, sync, pricing, extensibility; propose 3+ differentiating features aligned with encrypted offline-first journaling positioning (FR-026); rate each feature by complexity (S/M/L), user impact (Low/Med/High), and alignment with core value prop (FR-027, SC-008). Ref: spec.md FR-025–FR-027 (competitive analysis requirements), spec.md SC-008 (success criteria)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation updates

- [ ] T049 Update `CLAUDE.md` with monorepo workspace structure, new packages (`@reflog/shared`, `@reflog/cli`), updated commands (`yarn workspaces run ...`), and new dependencies (Commander.js, Auth0 Management API). Ref: plan.md Technical Context (dependencies list)
- [X] T050 Update `README.md` with monorepo workspace layout, getting-started instructions for `yarn install` at root, and links to CLI tool usage
- [X] T051 Run full validation across all workspaces: `yarn workspaces run typecheck && yarn workspaces run lint && yarn workspaces run test && yarn workspaces run build` and `yarn test:e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core MVP
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1
- **US3–US6 (Phases 5–8)**: Research deliverables — depend on Phase 2 for context but no code dependencies; can run in parallel with US1/US2
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only. No dependencies on other stories. **MVP target.**
- **US2 (P2)**: Depends on Phase 2 only. Can start in parallel with US1 (different files/packages).
- **US3 (P3)**: Research deliverable — no code dependencies. Can start after Phase 2.
- **US4 (P4)**: Research deliverable — no code dependencies. Can start after Phase 2.
- **US5 (P5)**: Research deliverable — no code dependencies. Can start after Phase 2.
- **US6 (P6)**: Research deliverable — no code dependencies. Can start anytime.

### Within Each User Story

- Auth0 setup docs (T019) before CLI lib tasks (T020, T021) — provides credential values
- CLI lib tasks (T020, T021, T022) before CLI command tasks (T023–T026)
- DB queries (T016) before API route implementations (T027–T030)
- Route implementations (T027–T030) before route registration (T031)
- Content files (T032, T033) before route components (T034, T035) — technically parallel since route components import content at build time
- Landing page (T036) and auth gate (T037) after API routes are registered (T031)
- Footer links (T038) after legal page routes exist (T034, T035)
- D1 preview provisioning (T043) before preview deploys can work (T041)

### Parallel Opportunities

Maximum parallelism within US1 after prerequisites are met:

```text
Workstream A (CLI):       T019 → T020+T021 → T022 → T023|T024|T025 → T026
Workstream B (API):       T016 → T027|T028|T029|T030 → T031
Workstream C (Legal):     T032|T033|T034|T035
Workstream D (UI):        T036, T037 (after T031), T038 (after T034+T035)
```

- **Phase 1**: T005 and T006 can run in parallel (independent package scaffolds)
- **Phase 2**: T013 can run in parallel with T012 (different files in shared package)
- **Phase 3 (US1)**: CLI commands T023/T024/T025 are parallel (different files). API routes T027/T028/T029/T030 are parallel (different files). Legal content T032/T033 and route components T034/T035 are parallel.
- **Cross-story**: US1 and US2 can proceed in parallel after Phase 2. All research deliverables (US3–US6) can proceed in parallel with each other and with US1/US2.

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + US1)

1. Complete Phase 1: Monorepo migration (atomic restructure)
2. Complete Phase 2: Shared types, D1 schema, CI updates
3. Complete Phase 3: Invite system, legal pages, landing page, auth gate
4. **STOP and VALIDATE**: Full invite flow end-to-end, legal pages render, CI passes
5. Deploy to production — beta is launchable with invite-only access

### Incremental Delivery

1. Phase 1 + Phase 2 → Monorepo foundation ready
2. US1 → Invite system + legal pages → **Beta launchable** (MVP!)
3. US2 → Preview environment → Pre-production testing enabled
4. US3–US6 → Research deliverables → Strategic planning complete
5. Polish → Documentation and final validation

### Research Deliverables (US3–US6)

These are document outputs, not code. They can be written at any point after Phase 2 provides enough architectural context. They do not block the beta launch — the beta launches with US1 (invites + legal pages) and optionally US2 (preview environment).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- `Ref:` annotations point to source document sections — read the referenced section for full implementation context
- The Reference Map at the top provides a reverse index: given a document, find all tasks that depend on it
- The monorepo migration (Phase 1) is treated as atomic — commit as a single change
- Auth0 setup (T019 production, T040 dev tenant) requires manual Dashboard configuration — document steps, not automate
- D1 preview database must be pre-provisioned via `wrangler d1 create reflog-sync-preview` (T043) before preview deploys work
- D1 schema migration (T018) is idempotent — safe to re-run at any time
- All research deliverables go to `specs/005-beta-readiness/deliverables/`
- Tier enforcement (25 MB / 2 devices) is explicitly OUT OF SCOPE — beta users get existing 50 MB / 10 device limits
