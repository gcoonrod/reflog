# Tasks: CI Pipeline for Pull Request Checks

**Input**: Design documents from `/specs/002-ci-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: No automated tests requested. Verification is done via a live test PR (final phase).

**Organization**: Tasks are grouped by user story to enable incremental implementation. All jobs are added to a single file (`.github/workflows/ci.yml`), so [P] markers apply only to tasks targeting different files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin Node.js version, install coverage dependency, configure Vitest reporters. These changes are prerequisites for the CI workflow to function correctly.

**Ref**: [plan.md#step-1](./plan.md#step-1-create-nvmrc), [plan.md#step-2](./plan.md#step-2-add-coverage-dependency-and-configure-vitest)

- [x] T001 [P] Create `.nvmrc` with content `22` in repository root — pins Node.js version for CI and local dev. Ref: [plan.md#nodejs-version-pinning](./plan.md#nodejs-version-pinning), [research.md#R7](./research.md#r7-runner-environment--pinning-strategy)
- [x] T002 [P] Install `@vitest/coverage-v8` dev dependency — run `yarn add -D @vitest/coverage-v8`. Ref: [plan.md#vitest-configuration-changes](./plan.md#vitest-configuration-changes), [research.md#R6](./research.md#r6-coverage-reporting)
- [x] T003 Update `vitest.config.ts` with coverage configuration (`provider: "v8"`, reporters: `["text", "html", "json-summary"]`, reportsDirectory: `"./coverage"`) and CI-conditional JUnit reporter (`reporters: ["default", "junit"]`, `outputFile: { junit: "./test-results/junit.xml" }`). Use exact config from [plan.md#vitest-configuration-changes](./plan.md#vitest-configuration-changes). Depends on T002
- [x] T004 [P] Add `coverage/`, `test-results/`, and `playwright-report/` to `.gitignore` — these are CI-generated output directories that should not be committed
- [x] T005 Run `yarn test` locally to verify Vitest config changes don't break existing tests. Depends on T003

**Checkpoint**: All local config changes complete. CI workflow creation can begin.

---

## Phase 2: Foundational (Workflow Scaffold)

**Purpose**: Create the GitHub Actions workflow file with top-level configuration (trigger, concurrency, permissions). This is the skeleton that all jobs will be added to.

**⚠️ CRITICAL**: All user story jobs depend on this scaffold existing.

**Ref**: [plan.md#step-3](./plan.md#step-3-create-workflow-scaffold), [plan.md#workflow-skeleton](./plan.md#workflow-skeleton)

- [x] T006 Create `.github/workflows/` directory structure
- [x] T007 Create `.github/workflows/ci.yml` with workflow scaffold: `name: CI`, `on: pull_request` targeting `develop` branch (types: opened, synchronize, reopened), `concurrency` group keyed on PR number with `cancel-in-progress: true`, and `permissions` block (`contents: read`, `security-events: write`). Use exact YAML from [plan.md#workflow-skeleton](./plan.md#workflow-skeleton). Ref: [research.md#R8](./research.md#r8-concurrency-control). Depends on T006

**Checkpoint**: Workflow scaffold ready — jobs can now be added. Satisfies FR-001, FR-002, FR-011.

---

## Phase 3: User Story 1 — Automated Quality Gate (Priority: P1) 🎯 MVP

**Goal**: Lint, typecheck, and unit/integration test checks run automatically on PRs against `develop` and report as individual status checks.

**Independent Test**: Open a PR against `develop`. Verify that `lint`, `typecheck`, and `unit-tests` appear as individual status checks. Push a commit with a lint violation and verify the lint check fails.

**Ref**: [plan.md#step-4](./plan.md#step-4-add-lint-typecheck-and-format-check-jobs), [plan.md#step-5](./plan.md#step-5-add-unit-tests-job)

### Implementation for User Story 1

- [x] T008 [US1] Add `lint` job to `.github/workflows/ci.yml` — `runs-on: ubuntu-24.04`, shared preamble (checkout, setup-node with `.nvmrc` + `cache: 'yarn'`, `yarn install --frozen-lockfile`), then `yarn lint`. Ref: [plan.md#job-1-lint](./plan.md#job-1-lint), [plan.md#shared-job-preamble](./plan.md#shared-job-preamble). Satisfies FR-003. Depends on T007
- [x] T009 [US1] Add `typecheck` job to `.github/workflows/ci.yml` — same shared preamble as lint, then `yarn typecheck`. Ref: [plan.md#job-2-typecheck](./plan.md#job-2-typecheck). Satisfies FR-004. Depends on T007
- [x] T010 [US1] Add `unit-tests` job to `.github/workflows/ci.yml` — shared preamble, then `yarn test -- --coverage`. Add two artifact upload steps: (1) `coverage-report` from `coverage/` with `if: ${{ !cancelled() }}` (always uploads), (2) `test-results` from `test-results/` with `if: ${{ failure() }}` (only on failure). Use `actions/upload-artifact@v4`. Ref: [plan.md#job-4-unit-tests](./plan.md#job-4-unit-tests), [research.md#R5](./research.md#r5-test-reporting--human-readable-artifacts), [research.md#R6](./research.md#r6-coverage-reporting). Satisfies FR-005. Depends on T007

**Checkpoint**: Core quality gate operational — lint, typecheck, and unit tests run on every PR. Satisfies US1 acceptance scenarios 1–6, FR-003, FR-004, FR-005, FR-010 (partial), FR-012 (via setup-node cache), FR-015 (parallel jobs), FR-016 (pinned runner).

---

## Phase 4: User Story 2 — E2E Test Validation (Priority: P2)

**Goal**: E2E tests run against the built application on every PR, with failure artifacts (HTML report, traces, screenshots) uploaded for debugging.

**Independent Test**: Open a PR that removes a required UI element (e.g., delete the "Unlock" button). Verify the `e2e-tests` check fails and downloadable artifacts appear.

**Ref**: [plan.md#step-6](./plan.md#step-6-add-e2e-tests-job), [plan.md#playwright-browser-caching](./plan.md#playwright-browser-caching)

### Implementation for User Story 2

- [x] T011 [US2] Add `e2e-tests` job to `.github/workflows/ci.yml` — shared preamble, then Playwright browser caching block (get version → cache browsers at `~/.cache/ms-playwright` keyed on version → conditional install with `--with-deps chromium` on miss or `install-deps chromium` on hit), then `yarn build`, then `yarn test:e2e`. Add two artifact upload steps on failure: (1) `playwright-report` from `playwright-report/`, (2) `e2e-traces` from `test-results/`. Use exact Playwright caching YAML from [plan.md#playwright-browser-caching](./plan.md#playwright-browser-caching). Ref: [plan.md#job-5-e2e-tests](./plan.md#job-5-e2e-tests), [research.md#R2](./research.md#r2-dependency-caching-strategy), [research.md#R5](./research.md#r5-test-reporting--human-readable-artifacts). Satisfies FR-006, FR-013, FR-014 (via existing playwright.config.ts retries). Depends on T007

**Checkpoint**: Full test coverage — unit + E2E. Satisfies US2 acceptance scenarios 1–3, FR-006, FR-013, FR-014.

---

## Phase 5: User Story 3 — Code Security Scanning (Priority: P3)

**Goal**: Dependency vulnerability audit and code security analysis run on every PR. Checks fail on critical/high severity findings, pass with warnings on medium/low.

**Independent Test**: Verify the `security` check appears on a PR. The existing `minimatch` high-severity advisory should cause the audit step to report (and potentially fail, confirming severity filtering works).

**Ref**: [plan.md#step-7](./plan.md#step-7-add-security-job), [plan.md#yarn-audit-severity-filtering](./plan.md#yarn-audit-severity-filtering)

### Implementation for User Story 3

- [x] T012 [US3] Add `security` job to `.github/workflows/ci.yml` — shared preamble, then two steps: (1) Dependency audit using `yarn audit --json` piped through the Node.js severity-filtering wrapper script (exits non-zero only on critical/high). Use exact script from [plan.md#yarn-audit-severity-filtering](./plan.md#yarn-audit-severity-filtering). (2) CodeQL init with `github/codeql-action/init@v3` (languages: `javascript-typescript`) followed by `github/codeql-action/analyze@v3` (no autobuild needed for JS/TS). Ref: [plan.md#job-6-security](./plan.md#job-6-security), [research.md#R3](./research.md#r3-security-scanning--dependency-audit), [research.md#R4](./research.md#r4-security-scanning--code-analysis). Satisfies FR-008, FR-009. Depends on T007

**Checkpoint**: Security scanning operational. Note: the current codebase has high-severity `minimatch` advisories via transitive deps — the audit step will fail until those are resolved upstream. This is expected behavior per the clarified severity policy. Satisfies US3 acceptance scenarios 1–4, FR-008, FR-009.

---

## Phase 6: User Story 4 — Code Quality Analysis (Priority: P4)

**Goal**: Prettier format checking runs on every PR, failing if files are inconsistently formatted.

**Independent Test**: Open a PR with an unformatted file. Verify the `format-check` status check fails.

**Ref**: [plan.md#step-4](./plan.md#step-4-add-lint-typecheck-and-format-check-jobs)

### Implementation for User Story 4

- [x] T013 [US4] Add `format-check` job to `.github/workflows/ci.yml` — same shared preamble as lint/typecheck, then `yarn format:check`. Ref: [plan.md#job-3-format-check](./plan.md#job-3-format-check). Satisfies FR-007. Depends on T007

**Checkpoint**: All six status checks implemented — lint, typecheck, unit-tests, e2e-tests, security, format-check. Satisfies US4 acceptance scenarios 1–2, FR-007, FR-010 (complete), SC-002.

---

## Phase 7: Polish & Verification

**Purpose**: Run local quality gate to ensure project changes don't break anything, then verify the full pipeline via a live test PR.

**Ref**: [plan.md#step-8](./plan.md#step-8-run-quality-gate-locally), [plan.md#step-9](./plan.md#step-9-verify-via-test-pr), [quickstart.md#verification-steps](./quickstart.md#verification-steps)

- [x] T014 Run full quality gate locally: `yarn typecheck && yarn lint && yarn test && yarn build && yarn test:e2e` — verify all project changes pass before committing
- [x] T015 Commit all changes and push to the `002-ci-pipeline` branch
- [x] T016 Create a PR against `develop` and verify all 6 status checks appear: `lint`, `typecheck`, `format-check`, `unit-tests`, `e2e-tests`, `security`. Verify `lint`, `typecheck`, `format-check`, `unit-tests`, and `e2e-tests` pass (green). The `security` check is expected to fail due to known high-severity `minimatch` transitive dependency advisories (via eslint, typescript-eslint, workbox) — verify the failure is from the audit step citing `minimatch`, not a CodeQL or configuration error. Follow full verification procedure in [quickstart.md#verification-steps](./quickstart.md#verification-steps). Satisfies SC-001 through SC-006. Depends on T015
- [ ] T017 Verify caching works — push a second commit to the same PR and confirm "Cache restored" appears in the setup-node step logs. Satisfies SC-007. Depends on T016

**Checkpoint**: CI pipeline fully operational and verified. All functional requirements and success criteria validated.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: T006 has no dependencies; T007 depends on T006
- **User Stories (Phases 3–6)**: All depend on T007 (workflow scaffold). Stories target different sections of the same file but can be implemented sequentially in priority order
- **Polish (Phase 7)**: Depends on all user story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T007 (scaffold). Also depends on T003 (vitest config) for the unit-tests job to produce reports correctly
- **User Story 2 (P2)**: Depends on T007 (scaffold) only — Playwright config already exists
- **User Story 3 (P3)**: Depends on T007 (scaffold) only — audit wrapper is inline YAML, CodeQL actions are external
- **User Story 4 (P4)**: Depends on T007 (scaffold) only — simplest job, identical structure to lint

### Within Each User Story

All user story tasks (T008–T013) add jobs to the same file (`.github/workflows/ci.yml`), so they are sequential within the file but independent in logic. The recommended order is P1 → P4 → P2 → P3 (simple jobs first, complex jobs last), though the plan's sequence (P1 → P2 → P3 → P4) groups by user story priority.

### Parallel Opportunities

- **Phase 1**: T001, T002, and T004 can run in parallel (different files)
- **Phase 1 → Phase 2**: Can overlap — T006/T007 don't depend on T001–T005
- **Phases 3–6**: All target the same file, so true parallelism isn't possible. However, each job is a self-contained YAML block that can be authored independently and merged

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational scaffold (T006–T007)
3. Complete Phase 3: User Story 1 — lint + typecheck + unit-tests (T008–T010)
4. **STOP and VALIDATE**: Push and open a test PR — verify 3 status checks appear and work
5. Proceed to remaining stories

### Incremental Delivery

1. Setup + Foundational → Scaffold ready
2. Add US1 (lint, typecheck, unit-tests) → 3 checks live (MVP!)
3. Add US4 (format-check) → 4 checks live (trivial addition, same pattern)
4. Add US2 (e2e-tests) → 5 checks live (most complex job)
5. Add US3 (security) → 6 checks live (complete)
6. Verify everything via test PR → Done

---

## Notes

- All 6 jobs go in a single file: `.github/workflows/ci.yml` — see [research.md#R1](./research.md#r1-github-actions-workflow-structure--single-vs-multiple-files) for rationale
- No secrets required — see [plan.md#environment-variables--secrets](./plan.md#environment-variables--secrets)
- The `minimatch` high-severity audit finding (transitive dep via eslint, typescript-eslint, workbox) will cause the security job to fail until resolved. This is correct behavior per the severity policy
- Commit after each phase or logical group
- Stop at any checkpoint to validate the pipeline incrementally
