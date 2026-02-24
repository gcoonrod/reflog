# Implementation Plan: Beta Readiness

**Branch**: `005-beta-readiness` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-beta-readiness/spec.md`

## Summary

Prepare Reflog for a consumer-ready limited beta with <$10/month operating costs. The work spans six areas: (1) restructure the repository into a Yarn Classic monorepo with workspaces, (2) implement an invite-only signup system with a CLI management tool, (3) add a preview environment for pre-production testing, (4) ship legal pages (ToS + Privacy Policy), (5) produce research deliverables (pricing model, payment processor comparison, gap analysis, future roadmap), and (6) update CI/CD for the new structure.

Payment processing implementation is explicitly out of scope — beta users get free access. Tier enforcement is deferred post-beta.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`) — client, Worker, and CLI
**Primary Dependencies**: TanStack Start + React 19 + Mantine v8 (web), Hono v4.x (Worker), Commander.js (CLI), `@auth0/auth0-react` v2.15 (client), Auth0 Management API (CLI)
**Storage**: IndexedDB via Dexie.js v4.3 (client), Cloudflare D1 (server — production + preview databases)
**Testing**: Vitest (unit/integration/contract), Playwright (E2E)
**Target Platform**: PWA (browser, installable) + Cloudflare Workers (edge) + CLI (Node.js local)
**Project Type**: Monorepo (Yarn Classic workspaces) — 4 packages
**Performance Goals**: N/A for this feature (no new user-facing latency-sensitive paths beyond existing sync)
**Constraints**: <$10/month total infrastructure cost, 50 beta user cap, zero-knowledge server (Constitution Principle I)
**Scale/Scope**: 50 beta users, 3 new D1 tables, 4 new API endpoints, 1 new CLI tool, 2 new public pages, 5 research documents

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Privacy-First, Device-Encrypted Data | PASS | Invite tokens, waitlist emails, and beta config are operational metadata (permitted). No user-authored content is stored unencrypted. Legal pages are static public content. |
| II. Offline-First PWA | PASS | Invite verification happens during initial login only. Once authenticated, the app works offline. Waitlist and legal pages are public routes that don't require offline support. |
| III. Developer-Centric Minimalism | PASS | No new UI chrome beyond the landing/waitlist page and footer links. CLI tool follows terminal-native UX. |
| IV. Strict TypeScript & Modular Architecture | PASS | All new code (CLI, invite API, legal pages) in strict TypeScript. CLI is a separate workspace with its own types. Shared types in `@reflog/shared`. |
| V. Robust Error Boundaries | PASS | Invite verification failures degrade gracefully (show "invite required" screen, not blank page). Waitlist submission handles network errors. |
| VI. Git Flow & Commit Discipline | PASS | Feature branch `005-beta-readiness` from `develop`. Monorepo migration committed as a single atomic move. |

**Post-Phase 1 re-check**: PASS. New D1 tables contain only operational metadata (invite tokens, emails, config keys). No user content touches the new tables. Constitution Principle I's "Constrained" metadata category applies — invite emails are operationally necessary for beta access control and are documented in the data model.

## Project Structure

### Documentation (this feature)

```text
specs/005-beta-readiness/
├── plan.md              # This file
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: new D1 tables
├── quickstart.md        # Phase 1: integration guide
├── contracts/
│   ├── invite-api.md    # Phase 1: invite + waitlist API endpoints
│   └── legal-pages.md   # Phase 1: ToS + privacy policy contracts
└── tasks.md             # Phase 2: task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Monorepo with Yarn Classic Workspaces
packages/
├── web/                           # PWA frontend (@reflog/web)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── postcss.config.cjs
│   ├── public/
│   │   ├── _redirects
│   │   ├── sw.js
│   │   └── icons/
│   └── src/
│       ├── components/
│       │   ├── auth/              # Existing auth components
│       │   ├── common/
│       │   ├── editor/
│       │   ├── layout/
│       │   ├── search/
│       │   ├── sync/
│       │   ├── tags/
│       │   ├── timeline/
│       │   └── vault/
│       ├── routes/
│       │   ├── __root.tsx
│       │   ├── login.tsx
│       │   ├── terms.tsx          # NEW: Terms of Service page
│       │   ├── privacy.tsx        # NEW: Privacy Policy page
│       │   ├── landing.tsx        # NEW: Beta landing page (unauthenticated)
│       │   ├── _app.tsx
│       │   └── _app/
│       │       └── ...            # Existing protected routes
│       ├── content/               # NEW: Static markdown content
│       │   ├── terms.md
│       │   └── privacy.md
│       ├── hooks/
│       ├── services/
│       ├── db/
│       ├── types/
│       ├── utils/
│       └── theme/
│
├── sync-api/                      # Cloudflare Worker (@reflog/sync-api)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── wrangler.toml              # Updated: [env.preview] section added
│   └── src/
│       ├── index.ts
│       ├── db/
│       │   ├── queries.ts
│       │   └── schema.sql         # Updated: invite, waitlist, beta_config tables
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── cors.ts
│       │   ├── invite.ts          # NEW: Invite verification middleware
│       │   ├── rateLimit.ts
│       │   ├── user.ts
│       │   └── validation.ts
│       └── routes/
│           ├── health.ts
│           ├── sync.ts
│           ├── account.ts
│           ├── devices.ts
│           ├── invites.ts         # NEW: POST /invites/verify, /invites/consume
│           ├── waitlist.ts        # NEW: POST /waitlist
│           └── beta.ts            # NEW: GET /beta/status
│
├── cli/                           # Operator CLI tool (@reflog/cli)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # CLI entry point
│       ├── commands/
│       │   ├── invite.ts          # invite create, list, revoke
│       │   ├── waitlist.ts        # waitlist list
│       │   └── config.ts          # config set, config get (beta cap, etc.)
│       └── lib/
│           ├── auth0.ts           # Auth0 Management API client
│           └── d1.ts              # D1 database client (via Wrangler)
│
└── shared/                        # Shared types (@reflog/shared)
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── sync.ts                # SyncRecord, PushRequest, PullResponse
        └── invite.ts              # Invite, WaitlistEntry, BetaConfig types

# Root-level (not in packages/)
tests/                             # UI unit/integration/contract/E2E tests
├── unit/
├── integration/
├── contract/
└── e2e/

specs/                             # Feature specifications
docs/                              # Documentation
.github/                           # CI/CD workflows
.specify/                          # Speckit tooling

# Root config files
package.json                       # Workspace root (private: true)
tsconfig.json                      # Base TypeScript config (extended by packages)
eslint.config.js                   # Shared ESLint config
.prettierrc                        # Shared Prettier config
playwright.config.ts               # E2E test config (references packages/web)
.nvmrc                             # Node.js version
.env.example                       # Environment variable template
CHANGELOG.md
CLAUDE.md
README.md
```

**Structure Decision**: Yarn Classic workspaces with 4 packages (`web`, `sync-api`, `cli`, `shared`). This keeps the UI app and API cleanly separate from operator tooling and documentation, as requested. Root-level tests, specs, docs, and CI remain outside packages/ since they span multiple workspaces. The sync API remains a standalone Worker (not Pages Functions) because Rate Limiting bindings and Cron Triggers are not supported in Pages Functions. See [research.md](./research.md) §R1 for monorepo rationale, §R8 for Pages Functions evaluation.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| 4 workspace packages | CLI tool needs its own dependency tree (Auth0 Management API, Commander.js) that conflicts with web app dependencies | Putting CLI commands inside `packages/web/` would add server-side Node.js deps to the browser bundle. Putting them in `packages/sync-api/` conflates Worker runtime with local CLI runtime. |
| Shared types package | Sync types (`SyncRecord`, `PushRequest`) and invite types are used by 3 packages (web, sync-api, cli) | Copy-pasting types causes drift. The existing `src/types/sync.ts` is already conceptually duplicated in the Worker. |
| Separate Auth0 dev tenant | Preview environments need callback URLs (`*.pages.dev`) that should not be on the production tenant | Single tenant with multiple applications shares user databases and Action pipelines; a preview bug could affect production users. |
