# Tasks: CD Pipeline and Production Hosting

**Input**: Design documents from `/specs/003-cd-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: Not requested. This feature is CI/CD infrastructure with no automated tests — verification is via manual test deployment in Phase 5.

**Organization**: Tasks are grouped by user story. US3 (Changelog-Driven Release Notes) has no unique implementation tasks — it is fully delivered by the combination of T001 (CHANGELOG.md creation) and the changelog guard step in the deploy job (T003). This is noted explicitly in Phase 3.

**Final Architecture Note**: The original plan used a separate `cd.yml` with a `workflow_run` trigger chained to CI. During implementation, `workflow_run`'s `branches` filter proved unreliable — PR CI completions on develop triggered spurious CD runs despite the `branches: [main]` filter. The deploy job was moved into `ci.yml` as a conditional job (`if: github.ref == 'refs/heads/main'`) in v0.3.1, eliminating this class of bugs entirely. Task descriptions below reflect the original plan; see plan.md for the final architecture.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths and plan.md section references in descriptions

---

## Phase 1: Setup

**Purpose**: Create the CHANGELOG.md file that the deploy job's changelog guard will validate against.

- [x] T001 Create `CHANGELOG.md` in the repository root with backfilled entries for v0.1.0 and v0.2.0. Copy the exact content from [plan.md § CHANGELOG Format](./plan.md#changelog-format). The version header format `## [x.y.z]` is the contract between this file and the deploy job's changelog guard ([research.md R3](./research.md#r3-changelog-validation-in-github-actions)).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modify the CI workflow to run on pushes to `main` so the deploy job can execute after CI jobs pass.

**CRITICAL**: The deploy job will not run without this change. It requires CI to trigger on `push: branches: [main]`.

- [x] T002 Update `.github/workflows/ci.yml`: (1) add `push: branches: [main]` and `workflow_dispatch` to the `on:` trigger block, (2) change the concurrency group from `ci-${{ github.event.pull_request.number }}` to `ci-${{ github.ref }}` so push events get a valid group key, and (3) change `cancel-in-progress` to `${{ github.event_name == 'pull_request' }}` so stale PR runs are cancelled but in-flight main pushes (which include the deploy job) are never cancelled. See [research.md R4](./research.md#r4-ci-check-verification-in-cd-workflows) for why the push trigger is needed.

**Checkpoint**: T001 and T002 are parallelizable (different files, no dependency). Both must complete before Phase 3.

---

## Phase 3: US1 + US3 — Automated Production Deployment with Changelog Enforcement (P1, P3) :dart: MVP

**Goal**: Add a deploy job to `ci.yml` that automatically builds and deploys to Cloudflare Pages on push to `main`, gated by version check, changelog check, and CI success. This phase also delivers US3 (changelog enforcement) via the changelog guard step embedded in the deploy job.

**Independent Test**: Merge a release branch to `main` with a bumped version and CHANGELOG.md entry. Verify the deploy job triggers after CI passes, passes all guards, deploys, and creates a git tag. Then push without a version bump and verify deployment is skipped gracefully.

**US3 Coverage**: US3 (Changelog-Driven Release Notes) requires two things: (1) a CHANGELOG.md file exists (delivered by T001), and (2) the CD pipeline enforces that every deployed version has a corresponding entry (delivered by the changelog guard step in T003). No additional tasks are needed for US3.

### Implementation

- [x] T003 [US1] Add a `deploy` job to `.github/workflows/ci.yml` gated by `if: github.ref == 'refs/heads/main'` with `needs: [lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit]`. The deploy job includes: job-level `concurrency` with `cancel-in-progress: false` ([R6](./research.md#r6-concurrency-controls-for-cd-workflows)), job-level `permissions` (`contents: write`, `deployments: write`), version guard comparing `package.json` against git tags ([R2](./research.md#r2-version-comparison-in-cd-workflows)), changelog guard via grep ([R3](./research.md#r3-changelog-validation-in-github-actions)), `yarn build` step, SPA shell copy (`cp dist/client/_shell.html dist/client/index.html`), Cloudflare Pages deployment via `cloudflare/wrangler-action@v3` ([R1](./research.md#r1-cloudflare-pages-deployment-from-github-actions)), git tag creation, and `$GITHUB_STEP_SUMMARY` output for all three paths (success, skipped, failed). Also add `public/_redirects` with `/* /index.html 200` for SPA routing on Cloudflare Pages. Verify the deploy job matches the [Spec Requirements Mapping](./plan.md#spec-requirements-mapping) table.

**Checkpoint**: All code changes are complete (T001–T003). The deploy job exists but cannot deploy until Cloudflare Pages is configured (Phase 4).

---

## Phase 4: US2 — Production Hosting at Custom Domain (P2) :warning: MANUAL CHECKPOINT

**Goal**: Configure Cloudflare Pages to host the PWA at `reflog.microcode.io` with automatic SSL and global CDN.

**Independent Test**: Visit `https://reflog.microcode.io` after the first deployment and verify the site loads with a valid SSL certificate and the PWA installs correctly.

**IMPORTANT**: All tasks in this phase require manual developer action. An AI agent cannot perform these steps. Implementation must pause here until the developer confirms completion.

### Implementation

- [x] T004 [US2] **MANUAL**: Create Cloudflare account, create Pages project (`npx wrangler pages project create reflog --production-branch=main`), create API token (Account / Cloudflare Pages / Edit permission), and add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets. Follow [plan.md § One-Time Setup](./plan.md#one-time-setup-pre-implementation) steps 1–4. See [research.md R1](./research.md#r1-cloudflare-pages-deployment-from-github-actions) for token permission details.

- [x] T005 [US2] **MANUAL**: Add custom domain `reflog.microcode.io` in Cloudflare Pages dashboard (must be done BEFORE DNS), then create CNAME record in Route 53: `reflog.microcode.io` → `reflog.pages.dev` (TTL 300). Follow [plan.md § One-Time Setup](./plan.md#one-time-setup-pre-implementation) steps 5–6. See [research.md R5](./research.md#r5-cloudflare-pages-custom-domain-setup) for ordering constraint and SSL/CAA details. See [plan.md § DNS Configuration](./plan.md#dns-configuration) for the Route 53 record spec.

- [x] T006 [US2] Verify Cloudflare and DNS setup by running the verification commands from [plan.md § One-Time Setup](./plan.md#one-time-setup-pre-implementation): `gh secret list | grep CLOUDFLARE` to confirm secrets exist, and `dig CNAME reflog.microcode.io +short` to confirm DNS resolves to `reflog.pages.dev`.

**Checkpoint**: Hosting infrastructure is ready. The deploy job can now deploy. Proceed to Phase 5 for end-to-end verification.

---

## Phase 5: Polish & Verification

**Purpose**: Validate all code changes locally and run a full end-to-end test deployment.

- [x] T007 Run the quality gate locally: `yarn typecheck && yarn lint && yarn test && yarn build && yarn test:e2e`. All must pass before committing.

- [x] T008 Prepare and execute the test deployment: create a release branch from `develop`, bump `package.json` version, add a changelog entry, merge to `main`, and verify the full pipeline. Key checkpoints: CI runs on main, deploy job runs after all CI jobs pass, version guard passes, changelog guard passes, Cloudflare deployment succeeds, git tag is created, and `https://reflog.microcode.io` loads with valid SSL.

- [x] T009 Verify skip behavior: push a non-version-bump commit to `main` (e.g., a docs change). Confirm the deploy job runs but skips deployment with a step summary message indicating the version is already deployed. This validates FR-006 and SC-007.

- [x] T010 Run Lighthouse against `https://reflog.microcode.io` and verify: (1) performance score ≥ 90 (SC-002), (2) PWA installability check passes — manifest returns 200, service worker is registered, and the app is flagged as installable (FR-012).

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)          ─┐
                           ├─→ Phase 3 (US1+US3: deploy job) ─→ Phase 5 (Verify)
Phase 2 (Foundational)   ─┘                                          ↑
                                                                      │
Phase 4 (US2: Manual)    ────────────────────────────────────────────┘
```

- **Phase 1 + Phase 2**: No dependency between them — can run in parallel (T001 ‖ T002)
- **Phase 3**: Depends on Phase 1 (CHANGELOG.md must exist for guard) and Phase 2 (CI push trigger must exist for deploy job)
- **Phase 4**: No dependency on Phases 1–3. Can be done at any time, even before code work. However, it must be complete before Phase 5 verification.
- **Phase 5**: Depends on Phases 3 and 4 both being complete (code deployed to configured hosting)

### User Story Dependencies

- **US1 (Automated Deployment)**: Depends on T001 (CHANGELOG.md), T002 (CI push trigger), and T004–T006 (hosting setup). Delivered by T003.
- **US2 (Production Hosting)**: Independent of code changes. Manual setup only (T004–T006).
- **US3 (Changelog Enforcement)**: No unique tasks. Delivered by T001 + changelog guard in T003.

### Task-Level Dependencies

| Task | Depends on | Reason |
|------|-----------|--------|
| T001 | — | No dependencies |
| T002 | — | No dependencies |
| T003 | T001, T002 | Deploy job references CHANGELOG.md (guard) and requires CI push trigger |
| T004 | — | Manual, can start anytime |
| T005 | T004 | Pages project must exist before adding custom domain |
| T006 | T005 | DNS must be configured before verification |
| T007 | T001, T002, T003 | All code changes must exist to run quality gate |
| T008 | T007, T006 | Code must pass quality gate + hosting must be ready |
| T009 | T008 | First deployment must succeed before testing skip behavior |
| T010 | T008 | Site must be live before running Lighthouse |

### Parallel Opportunities

```text
# Phase 1 + Phase 2 can run in parallel:
T001 (CHANGELOG.md) ‖ T002 (ci.yml)

# Phase 4 can run in parallel with Phases 1–3:
T004–T006 (manual Cloudflare setup) ‖ T001–T003 (code changes)

# T009 and T010 can run in parallel (both depend only on T008):
T009 (skip behavior) ‖ T010 (Lighthouse + PWA)
```

---

## Implementation Strategy

### MVP First (US1 + US3)

1. Complete T001 + T002 in parallel (CHANGELOG.md + ci.yml updates)
2. Complete T003 (deploy job + SPA routing)
3. **PAUSE**: Developer completes manual setup (T004–T006)
4. Complete T007 (quality gate)
5. Complete T008 (test deployment) — validates US1, US2, and US3 together
6. Complete T009 + T010 in parallel (skip behavior + Lighthouse/PWA verification)

### Optimal Parallel Execution

If the developer starts manual Cloudflare setup early:

```text
Developer (manual):  T004 ──→ T005 ──→ T006
Agent (code):        T001 ‖ T002 ──→ T003 ──→ T007
                                                  ↓
                     (wait for T006) ──→ T008 ──→ T009 ‖ T010
```

---

## Notes

- T001 and T002 are the only parallelizable code tasks ([P] eligible) — they modify different files with no dependency.
- T003 adds the deploy job to ci.yml and the `public/_redirects` SPA routing file.
- T004 and T005 are manual — the agent must pause and prompt the developer to complete them.
- T008 is the primary acceptance test for all three user stories.
- T009 and T010 are parallel post-deployment verification tasks. T009 validates skip behavior (FR-006, SC-007). T010 validates performance and PWA installability (SC-002, FR-012).
- The total code delta for this feature is 3 files: 1 new (`CHANGELOG.md`), 1 new (`public/_redirects`), 1 modified (`ci.yml` — added push trigger, workflow_dispatch, conditional cancel-in-progress, and deploy job).
