# Tasks: CLI D1 REST API Migration

**Input**: Design documents from `/specs/006-cli-d1-rest-api/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No automated tests requested. Verification is manual smoke testing against live D1.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Reference Map

Each task references specific design document sections. Read the referenced sections before starting the task.

| Task | Primary Reference | Source File (read first) |
|---|---|---|
| T001 | `data-model.md` → Configuration (CoreConfig, Auth0Config) | `packages/cli/.env.example` |
| T002 | `contracts/d1-rest-api.md` (full file), `data-model.md` → D1 Response Shapes, `research.md` → R1, R5 | `packages/cli/src/lib/d1.ts` |
| T003 | `data-model.md` → Configuration + Config Loading, `research.md` → R4, R6 | `packages/cli/src/lib/config.ts` |
| T004 | `data-model.md` → Auth0Config | `packages/cli/src/lib/auth0.ts` |
| T005 | `contracts/d1-rest-api.md` → CLI Query Interface (before/after signature) | `packages/cli/src/commands/invite.ts` |
| T006 | `contracts/d1-rest-api.md` → CLI Query Interface | `packages/cli/src/commands/waitlist.ts` |
| T007 | `contracts/d1-rest-api.md` → CLI Query Interface | `packages/cli/src/commands/config.ts` |
| T008 | `research.md` → R6 (--env flag behavior) | `packages/cli/src/index.ts` |
| T009 | `research.md` → R5 (error taxonomy table) | `packages/cli/src/lib/d1.ts` (as written by T002) |
| T010 | `spec.md` → Edge Cases (--env file not found, missing variables) | `packages/cli/src/lib/config.ts` (as written by T003) |

---

## Phase 1: Setup

**Purpose**: Update configuration template before code changes

- [x] T001 Update `packages/cli/.env.example` — read the current file, then restructure it into two sections. **Core Cloudflare variables** (required by all commands): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`. **Auth0 variables** (required only for `invite create`): `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`. Remove `AUTH0_AUDIENCE` (no longer used — see `research.md` R3). Add comment headers separating the sections. See `data-model.md` → CoreConfig and Auth0Config for the exact field names and env var mappings.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rewrite the two core lib modules that ALL commands depend on. No command module can be updated until these are complete.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Rewrite `packages/cli/src/lib/d1.ts` — read the current file first (it uses `execFile("npx", ["wrangler", ...])` and parses stdout JSON). Replace the entire implementation with a native `fetch()` call to the D1 REST API. Follow these references step by step:
  - **Endpoint, request body, auth header**: `contracts/d1-rest-api.md` → Endpoint, Authentication, Request sections
  - **New function signature**: `contracts/d1-rest-api.md` → CLI Query Interface → "After" block: `query<T>(sql: string, params: QueryParam[], config: CoreConfig): Promise<D1Result<T>>`
  - **Type definitions** (`CoreConfig`, `QueryParam`, `D1Result<T>`, `D1ResultSet`, `D1Meta`): `data-model.md` → CoreConfig table + D1ResultSet/D1Meta tables. Note: `CoreConfig` should be imported from `config.ts` (defined in T003), or define it here and re-export — coordinate with T003.
  - **Response parsing — TWO different shapes**: `data-model.md` → "D1 Response Shapes" section. HTTP 200 returns a raw array `[{...}]` — take index `[0]`. HTTP 4xx/5xx returns a Cloudflare envelope object `{ success, errors, result }`. The parser MUST check HTTP status first and branch.
  - **Error handling for each HTTP status code**: `research.md` → R5 error taxonomy table. Map each status to the exact CLI message string. Catch `fetch` network errors (TypeError) and produce the "Could not connect" message.
  - **SQL error (HTTP 200 but `success: false`)**: read the `error` string (singular) from the result set — see `contracts/d1-rest-api.md` → Response (SQL error).
  - **Catch-all for unexpected responses**: if the response body is not parseable as JSON or doesn't match either known shape (array for HTTP 200, envelope object for 4xx/5xx), throw `Error("Unexpected API response (HTTP <status>): <first 200 chars of body>")`. This covers spec.md edge case 3 ("unexpected response format").
  - **Remove**: `child_process`, `util` imports, `execFileAsync`, and the entire old `query()` body. Keep the function name and generic signature.

- [x] T003 Rewrite `packages/cli/src/lib/config.ts` — read the current file first (it has a single `loadConfig()` that validates all 5+ variables upfront). Replace with two-tier validation per `research.md` → R4 and the loading flow in `data-model.md` → Config Loading (4 steps). Specifically:
  - Define and export `CoreConfig` interface: `{ cloudflareApiToken: string; cloudflareAccountId: string; d1DatabaseId: string }` — field names from `data-model.md` → CoreConfig table.
  - Define and export `Auth0Config` interface: `{ auth0Domain: string; auth0ClientId: string; auth0ClientSecret: string }` — field names from `data-model.md` → Auth0Config table.
  - `loadCoreConfig(envPath?: string): CoreConfig` — calls `dotenv.config({ path: envPath ?? defaultPath })`, then validates the 3 core env vars are present. If `envPath` is provided and the file doesn't exist, throw `Error("File not found: <path>")` before calling dotenv. Error message for missing vars: list the missing names and reference `.env.example`.
  - `loadAuth0Config(envPath?: string): Auth0Config` — same dotenv loading (idempotent if already loaded), validates the 3 Auth0 env vars. Same error format for missing vars.
  - **Path resolution** (`research.md` → R6): absolute paths used as-is; relative paths resolved from `process.cwd()`. Default path: `resolve(__dirname, "../../.env")` (same as current code).
  - Remove: the old `CliConfig` interface, `loadConfig()` function, and `AUTH0_AUDIENCE` from the required list.

- [x] T004 Update `packages/cli/src/lib/auth0.ts` — read the current file first. Change `getManagementClient(config: CliConfig)` to `getManagementClient(config: Auth0Config)`. Update `createUser(config: CliConfig, ...)` and `triggerPasswordReset(config: CliConfig, ...)` to accept `Auth0Config`. The property names change: `config.auth0Domain` (was `config.auth0Domain`), `config.auth0ClientId` (was `config.auth0ClientId`), `config.auth0ClientSecret` (was `config.auth0ClientSecret`). Since the Auth0Config field names match the old CliConfig field names, the only real change is the type import — replace `import type { CliConfig }` with `import type { Auth0Config }`.

**Checkpoint**: Core lib modules ready — command modules can now be updated.

---

## Phase 3: User Story 1 — CLI Commands Without Wrangler (Priority: P1) MVP

**Goal**: All existing CLI commands produce identical output via the D1 REST API without wrangler installed or authenticated.

**Independent Test**: Run `reflog-cli config get max_beta_users` with a valid API token and no wrangler login. Compare output to previous wrangler-based result.

### Implementation for User Story 1

- [x] T005 [P] [US1] Update `packages/cli/src/commands/invite.ts` — read the current file first. It contains 6 SQL queries that use string interpolation with `sqlEscape()`. Convert each to parameterized form (see `contracts/d1-rest-api.md` → CLI Query Interface for the new `query()` signature). The 6 queries to convert:
  1. `SELECT id, status FROM invites WHERE email = '${safeEmail}'` → `query("SELECT id, status FROM invites WHERE email = ?", [email], config)`
  2. `SELECT value FROM beta_config WHERE key = 'invite_expiry_days'` → `query("SELECT value FROM beta_config WHERE key = ?", ["invite_expiry_days"], config)` (literal value, but still parameterize for consistency)
  3. `INSERT INTO invites (...) VALUES ('${inviteId}', '${safeEmail}', '${token}', 'pending', 'cli', '${now}', '${expiresAt}')` → `query("INSERT INTO invites (...) VALUES (?, ?, ?, 'pending', 'cli', ?, ?)", [inviteId, email, token, now, expiresAt], config)`
  4. `UPDATE waitlist SET invited = 1 WHERE email = '${safeEmail}'` → `query("UPDATE waitlist SET invited = 1 WHERE email = ?", [email], config)`
  5. `SELECT * FROM invites WHERE status = '${opts.status}' ORDER BY created_at DESC` → `query("SELECT * FROM invites WHERE status = ? ORDER BY created_at DESC", [opts.status], config)`
  6. `UPDATE invites SET status = 'revoked' WHERE email = '${safeEmail}' AND status = 'pending'` → `query("UPDATE invites SET status = 'revoked' WHERE email = ? AND status = 'pending'", [email], config)`
  Also: Remove `sqlEscape()` helper function. Remove `getD1Options()` helper. Remove `import { query, type D1Options }` and replace with `import { query } from "../lib/d1.js"` and `import { loadCoreConfig, loadAuth0Config } from "../lib/config.js"`. For `invite create` action: call both `loadCoreConfig(envPath)` and `loadAuth0Config(envPath)`. For `invite list` and `invite revoke`: call only `loadCoreConfig(envPath)`. Pass `Auth0Config` to `createUser()` and `triggerPasswordReset()`. The `envPath` comes from `inviteCommand.parent?.opts().env`.

- [x] T006 [P] [US1] Update `packages/cli/src/commands/waitlist.ts` — read the current file first. It has one SQL query with no user-supplied values. Replace `getD1Options()` with `loadCoreConfig(envPath)` where `envPath = waitlistCommand.parent?.opts().env`. Update the `query()` call: `query("SELECT * FROM waitlist ORDER BY created_at ASC", [], config)` — empty params array since no user input is interpolated. Update imports: remove `loadConfig` and `D1Options`, add `loadCoreConfig` from `"../lib/config.js"`.

- [x] T007 [P] [US1] Update `packages/cli/src/commands/config.ts` — read the current file first. It has 2 SQL queries using `sqlEscape()`. Convert to parameterized queries:
  1. `config get`: `query("SELECT * FROM beta_config WHERE key = ?", [key], config)`
  2. `config set`: `query("INSERT INTO beta_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')", [key, value, value], config)` — note `value` appears twice because the `ON CONFLICT` clause needs it separately.
  Keep `VALID_CONFIG_KEYS` whitelist — it validates that the key is a known config key, which is a logic concern separate from SQL injection. Remove `sqlEscape()`. Replace `getD1Options()` with `loadCoreConfig(envPath)` where `envPath = configCommand.parent?.opts().env`. Update imports.

**Checkpoint**: All commands work via REST API. Run each command and verify output matches previous behavior.

---

## Phase 4: User Story 2 — Environment Targeting via --env Path (Priority: P2)

**Goal**: Operator can switch between production and preview by passing `--env path/to/file.env`.

**Independent Test**: Create a `.env.preview` file with the preview `D1_DATABASE_ID` and run `reflog-cli --env .env.preview invite list` vs the default.

### Implementation for User Story 2

- [x] T008 [US2] Update `packages/cli/src/index.ts` — read the current file first. Change the `--env` option definition from `.option("--env <environment>", "Target environment for D1 (e.g., preview)")` to `.option("--env <path>", "Path to .env file (default: packages/cli/.env)")`. See `research.md` → R6 for the full flag behavior specification: absolute paths used as-is, relative paths resolved from cwd. The option value is already propagated to commands via `parent?.opts().env` (Commander.js parent option inheritance), so T005-T007 already consume it correctly. No additional wiring needed — this task is just the option description change.

**Checkpoint**: Verify `--env ./path/to/preview.env` loads the correct database. Verify omitting `--env` loads the default.

---

## Phase 5: User Story 3 — Clear Error Messages (Priority: P3)

**Goal**: Authentication failures, network errors, and missing config produce single-line actionable messages.

**Independent Test**: Run a command with an invalid `CLOUDFLARE_API_TOKEN` and verify the error message is clear and actionable.

### Implementation for User Story 3

- [x] T009 [US3] Verify error handling in `packages/cli/src/lib/d1.ts` — read the file as written by T002. Walk through each error path against the exact messages in `research.md` → R5 error taxonomy table:
  - HTTP 401 → `"Authentication failed (HTTP 401). Check your CLOUDFLARE_API_TOKEN."`
  - HTTP 403 → `"Access denied (HTTP 403). Ensure your API token has D1 read/write permissions."`
  - HTTP 404 → `"Database not found (HTTP 404). Check CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_ID."`
  - HTTP 429 → `"Rate limited by Cloudflare API. Try again in a few seconds."`
  - HTTP 5xx → `"Cloudflare API error (HTTP <status>). Try again later."`
  - Network error (fetch TypeError) → `"Could not connect to Cloudflare API: <error message>"`
  - HTTP 200 + `success: false` → `"D1 query error: <error string from result set>"`
  If any are missing or don't match, fix them. Ensure every error path uses `console.error()` + `process.exit(1)` or throws a descriptive Error — no unhandled exceptions that would dump a stack trace.

- [x] T010 [US3] Verify error handling in `packages/cli/src/lib/config.ts` — read the file as written by T003. Check against `spec.md` → Edge Cases:
  - Missing required core variables → error lists the missing variable names and references `.env.example`
  - `--env` path that doesn't exist → `"File not found: <path>"`
  - `--env` file exists but missing required variables → same missing-variable error as default case
  Fix any gaps.

**Checkpoint**: Test with invalid token, missing env file, and missing variables. Each should produce a single-line message with no stack trace.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [x] T011 Run `yarn workspace @reflog/cli typecheck` and fix any type errors in `packages/cli/`
- [ ] T012 Manually smoke test all commands against production D1 — `config get max_beta_users`, `config set`, `invite list`, `invite list --status pending`, `invite create` (if safe), `invite revoke`, `waitlist list`. Verify output matches previous wrangler-based behavior. See `quickstart.md` → Verification section for the exact commands.
- [ ] T013 Manually smoke test `--env` switching — run `invite list` with default `.env` and with `--env packages/cli/.env.preview` (or equivalent) and confirm different D1 databases are queried. See `quickstart.md` → Usage section for example commands.
- [x] T014 Verify no references to wrangler remain in `packages/cli/src/` — search for `wrangler`, `execFile`, `child_process`, `D1Options`, `CliConfig`, `AUTH0_AUDIENCE` across all CLI source files. Remove any stale imports or dead code.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories. T002 and T003 can run in parallel (different files). T004 depends on T003 (needs `Auth0Config` type export).
- **US1 (Phase 3)**: Depends on Phase 2 — T005, T006, T007 can run in parallel
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1 and US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (foundational lib rewrites). No dependency on other stories.
- **US2 (P2)**: Depends on Phase 2 (config.ts envPath support). No dependency on US1.
- **US3 (P3)**: Depends on Phase 2 (d1.ts error handling). No dependency on US1 or US2.

### Within Each User Story

- US1: T005, T006, T007 can all run in parallel (different command files, no shared state)
- US2: Single task (T008)
- US3: T009, T010 can run in parallel (different lib files)

### Parallel Opportunities

```bash
# Phase 2 internal parallelism:
# T002 (d1.ts) and T003 (config.ts) can run in parallel
# T004 (auth0.ts) runs after T003 completes

# After Phase 2 completes, these can all start in parallel:
# US1 command updates (T005, T006, T007 — all [P])
# US2 (T008)
# US3 (T009, T010 — both [P])
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (.env.example)
2. Complete Phase 2: Foundational (d1.ts, config.ts, auth0.ts)
3. Complete Phase 3: US1 (all 3 command modules)
4. **STOP and VALIDATE**: Run all commands, verify identical output via REST API
5. This alone delivers the core value — wrangler-free CLI

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 (Phase 3) → All commands work via REST API (MVP!)
3. Add US2 (Phase 4) → `--env` file path switching works
4. Add US3 (Phase 5) → Error messages verified
5. Phase 6 → Final polish, typecheck, dead code removal

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No automated tests — verification is manual smoke testing against live D1
- Commit after each phase completion
- The foundational phase (T002, T003, T004) does the bulk of the work; user story phases are primarily wiring changes
- **Every task starts with "read the current file first"** — understand the existing code before modifying it
