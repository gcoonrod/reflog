# Implementation Plan: CD Pipeline and Production Hosting

**Branch**: `003-cd-pipeline` | **Date**: 2026-02-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-cd-pipeline/spec.md`

## Summary

Configure Cloudflare Pages to host the Reflog PWA at `reflog.microcode.io`, then create a GitHub Actions CD workflow that automatically deploys on push to `main` after verifying CI passed, the version was bumped, and a CHANGELOG.md entry exists. Successful deployments are tagged in git.

## Technical Context

**Language/Version**: YAML (GitHub Actions), Bash (inline scripts), Node.js 22.x (for version extraction)
**Primary Dependencies**: GitHub Actions, Cloudflare Pages (via `cloudflare/wrangler-action@v3`), `wrangler` CLI
**Storage**: N/A (CD infrastructure only)
**Testing**: Manual verification via test deployment (no automated tests for CD workflows)
**Target Platform**: GitHub Actions (Ubuntu 24.04 runner), Cloudflare Pages (static hosting)
**Project Type**: CI/CD infrastructure configuration
**Performance Goals**: Push-to-production within 5 minutes (SC-001)
**Constraints**: $0/month hosting cost; must use existing Route 53 DNS; deployment secret stored in GitHub
**Scale/Scope**: Single repository, single workflow file, single hosting target

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Privacy-First, Local-Only Data | **PASS** | CD workflow does not handle user data. Cloudflare Pages serves static files only -- no server-side processing, analytics, or telemetry. |
| II. Offline-First PWA | **PASS** | CD deploys the existing PWA build (which includes SW/manifest). No changes to PWA behavior. |
| III. Developer-Centric Minimalism | **PASS** | CD is developer infrastructure. No UI changes. |
| IV. Strict TypeScript & Modular Architecture | **PASS** | CD validates the build (which enforces strict TS). No application code changes. |
| V. Robust Error Boundaries | **PASS** | Not applicable to CD configuration files. |
| VI. Git Flow & Commit Discipline | **PASS** | CD triggers on push to `main` (production branch per Git Flow). Tags each release. CI verification ensures quality gate is met before deployment. CHANGELOG.md enforcement aligns with commit discipline. |

**Gate result**: PASS -- no violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-cd-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml           # CI + CD workflow (modified: added push trigger, deploy job, workflow_dispatch)
    └── codeql.yml       # Existing CodeQL workflow (unchanged)

CHANGELOG.md             # New file (Keep a Changelog format)
public/
└── _redirects           # SPA routing rule for Cloudflare Pages
```

**Structure Decision**: The deploy job is inlined in `ci.yml` as a conditional job that only runs on pushes to `main`. This eliminates the need for a separate `cd.yml` file and avoids the unreliable `workflow_run` trigger that caused spurious deployments from PR CI completions. A `_redirects` file provides SPA routing on Cloudflare Pages.

## Environment Variables & Secrets

### Required Secrets

| Secret | Scope | Source | Purpose |
|--------|-------|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Repository | Cloudflare Dashboard > API Tokens | Authenticate wrangler for Pages deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Repository | Cloudflare Dashboard > Account Overview | Identify the Cloudflare account |

### Required Permissions

The CD workflow requires these GitHub token permissions:

```yaml
permissions:
  contents: write    # Push git tags after deployment
  deployments: write # Create GitHub deployment status
```

### One-Time Setup (Pre-Implementation)

These steps must be completed **by the developer manually** before the CD workflow can function. An AI agent cannot perform these steps — implementation must pause after Step 3 and resume after the developer confirms completion.

1. Create a Cloudflare account (free)
2. Create Cloudflare Pages project: `npx wrangler pages project create reflog --production-branch=main`
3. Create API token: Cloudflare Dashboard > My Profile > API Tokens > Custom Token > Account / Cloudflare Pages / Edit
4. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets
5. Add custom domain `reflog.microcode.io` in Cloudflare Pages dashboard > Custom domains
6. Create CNAME record in Route 53: `reflog.microcode.io` CNAME `reflog.pages.dev` (TTL 300)

**Verification**: After completing all 6 steps, confirm by running:
```bash
# Verify GitHub secrets exist (returns 200, not the values)
gh secret list | grep -E 'CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID'

# Verify DNS propagation
dig CNAME reflog.microcode.io +short
# Expected: reflog.pages.dev.
```

---

## Implementation Sequence

### Step 1: Create CHANGELOG.md

**Creates**: `CHANGELOG.md` (repository root)
**References**: [CHANGELOG Format](#changelog-format) for exact file content, [research.md R3](./research.md#r3-changelog-validation-in-github-actions) for the validation pattern the CD workflow will use against this file

Create `CHANGELOG.md` in the repository root following the Keep a Changelog 1.1.0 format. Backfill entries for existing versions (0.1.0, 0.2.0). The exact content is in the [CHANGELOG Format](#changelog-format) section below — copy it verbatim.

The CD workflow's changelog guard will validate this file using `grep -qE "^## \[${VERSION}\]" CHANGELOG.md`, so the version header format `## [x.y.z]` is load-bearing and must be exact.

### Step 2: Update CI workflow with push trigger and deploy job

**Modifies**: `.github/workflows/ci.yml`
**References**: [CI Workflow Changes](#ci-workflow-changes) for details, [research.md R1](./research.md#r1-cloudflare-pages-deployment-from-github-actions) (deployment), [R2](./research.md#r2-version-comparison-in-cd-workflows) (version guard), [R3](./research.md#r3-changelog-validation-in-github-actions) (changelog guard), [R6](./research.md#r6-concurrency-controls-for-cd-workflows) (concurrency)

The CI workflow is extended with three changes:

**Change 1 — Add push and workflow_dispatch triggers**: Add `push: branches: [main]` and `workflow_dispatch` to the `on:` block. Push triggers CI+CD on merges to main. `workflow_dispatch` enables manual deployment recovery.

**Change 2 — Conditional cancel-in-progress**: Change `cancel-in-progress` to `${{ github.event_name == 'pull_request' }}` so stale PR runs are cancelled but in-flight main pushes (which may include a deploy) are never cancelled.

**Change 3 — Inline deploy job**: Add a `deploy` job gated by `if: github.ref == 'refs/heads/main'` with `needs: [all CI jobs]`. This replaces the separate `cd.yml` and its unreliable `workflow_run` trigger. The deploy job has its own concurrency group (`production-deploy`) and elevated permissions (`contents: write`, `deployments: write`).

> **Why not a separate cd.yml?** The `workflow_run` trigger's `branches` filter does not reliably filter out PR-triggered CI completions, causing spurious CD runs. Inlining the deploy job in ci.yml eliminates this class of bugs entirely — the deploy job only evaluates when CI runs on `refs/heads/main`.

### Step 4: Configure Cloudflare Pages and DNS *(manual — human only)*

**Requires**: Developer intervention. AI agent must pause here.
**References**: [One-Time Setup](#one-time-setup-pre-implementation) for the 6 substeps, [research.md R5](./research.md#r5-cloudflare-pages-custom-domain-setup) for custom domain setup details, [DNS Configuration](#dns-configuration) for the Route 53 record and SSL details

Perform the 6 one-time setup steps listed in [One-Time Setup](#one-time-setup-pre-implementation). Key ordering constraint from R5: the custom domain must be added in the Cloudflare Pages dashboard **before** the CNAME record is created in Route 53.

**Checkpoint**: Do not proceed to Step 5 until the developer confirms all 6 setup steps are complete and the verification commands in that section succeed.

### Step 5: Run quality gate locally

**Modifies**: Nothing (validation only)

Verify all project changes pass:

```bash
yarn typecheck && yarn lint && yarn test && yarn build && yarn test:e2e
```

### Step 6: Verify via test deployment

**References**: [quickstart.md — Verification Steps](./quickstart.md#verification-steps) for the complete 10-step verification checklist with commands

Commit all changes, create a release branch, bump version, add changelog entry, merge to `main`, and verify the full CD pipeline. The key checkpoints are:

1. CI runs on `main` push and all jobs pass
2. Deploy job runs after all CI jobs pass (same workflow)
3. Version guard detects new version (no existing tag)
4. Changelog guard finds the version entry
5. Build succeeds and deployment to Cloudflare Pages completes
6. Git tag is created and pushed
7. `https://reflog.microcode.io` serves the application with valid SSL
8. A subsequent non-version-bump push skips deployment gracefully

---

## Deploy Job (inlined in ci.yml)

The deploy job is part of `.github/workflows/ci.yml`, gated by `if: github.ref == 'refs/heads/main'` and `needs: [all CI jobs]`. On PR runs to develop, the deploy job is automatically skipped (ref is not main). On pushes to main, it runs after all CI jobs pass. The `workflow_dispatch` trigger also enables manual recovery.

Key design decisions:
- **No separate cd.yml**: Eliminates the unreliable `workflow_run` trigger that caused spurious deployments from PR CI completions.
- **Job-level concurrency**: The deploy job has its own `production-deploy` concurrency group with `cancel-in-progress: false`, separate from the workflow-level CI concurrency group.
- **Job-level permissions**: Only the deploy job gets `contents: write` and `deployments: write`; CI jobs inherit the workflow-level `contents: read`.
- **Conditional cancel-in-progress**: `${{ github.event_name == 'pull_request' }}` cancels stale PR runs but never cancels main pushes (protecting in-flight deploys).
- **SPA shell copy**: TanStack Start outputs `_shell.html` as the SPA entry point; Cloudflare Pages requires `index.html` for the root route.

See the current `.github/workflows/ci.yml` for the complete workflow.

### Spec Requirements Mapping

| Step | Satisfies | Notes |
|------|-----------|-------|
| `push: branches: [main]` trigger | FR-001, FR-002 | Deploy job runs only on main; CI success required by `needs:` |
| `workflow_dispatch` trigger | Manual recovery | Enables re-deployment without code changes |
| Deploy job `concurrency` block | FR-008 | Queues deployments; see [research.md R6](./research.md#r6-concurrency-controls-for-cd-workflows) for rationale |
| Version guard | FR-003, FR-006, SC-007 | Skips gracefully when version unchanged |
| Changelog guard | FR-004, FR-007, FR-014, SC-003 | Fails with `::error::` annotation when entry missing |
| Build step | FR-005 | `yarn build` produces `dist/client/` |
| Copy SPA shell to index.html | FR-005 | TanStack Start `_shell.html` → Cloudflare Pages `index.html` |
| Cloudflare Pages deploy | FR-005, FR-009, FR-010, FR-011, FR-012, SC-006 | Hosting properties provided by Cloudflare Pages |
| Git tag creation | FR-003 (idempotency) | Tag is the source of truth for "already deployed" |
| Step summaries | FR-015 | Success, skipped, and failed paths all write to `$GITHUB_STEP_SUMMARY` |
| DNS CNAME (manual) | FR-013 | Configured in Step 4 |

---

## CI Workflow Changes

The existing `ci.yml` was extended to include the deploy job and updated triggers:

**1. Add push and workflow_dispatch triggers**: `push: branches: [main]` triggers CI+CD on merges to main. `workflow_dispatch` enables manual deployment recovery.

**2. Fix concurrency group**: Changed from `ci-${{ github.event.pull_request.number }}` (undefined for push events) to `ci-${{ github.ref }}` which resolves to `ci-refs/pull/123/merge` for PRs and `ci-refs/heads/main` for pushes.

**3. Conditional cancel-in-progress**: Changed from `true` to `${{ github.event_name == 'pull_request' }}` so stale PR runs are cancelled but in-flight main pushes (which include the deploy job) are never cancelled.

**4. Inline deploy job**: Added a `deploy` job with `if: github.ref == 'refs/heads/main'` and `needs: [lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit]`. The deploy job has its own concurrency group and elevated permissions.

> **Architecture note**: The original design used a separate `cd.yml` with a `workflow_run` trigger chained to CI completion. This was replaced because `workflow_run`'s `branches` filter does not reliably filter out PR-triggered CI completions, causing spurious deployments. The inline approach is simpler and eliminates this class of bugs entirely.

---

## DNS Configuration

**References**: [research.md R5](./research.md#r5-cloudflare-pages-custom-domain-setup)

### Route 53 Record

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `reflog.microcode.io` | `reflog.pages.dev` | 300 |

### SSL

Cloudflare Pages automatically provisions an SSL certificate for the custom domain. No manual certificate management is required. If the `microcode.io` zone has CAA records in Route 53, they must allow `digicert.com`, `letsencrypt.org`, and `pki.goog`. If no CAA records exist, no action is needed.

### Verification

After adding the CNAME and custom domain in Cloudflare Pages, domain ownership is verified automatically via the CNAME resolution. Propagation typically takes a few minutes.

---

## CHANGELOG Format

The project will use Keep a Changelog 1.1.0 format. The exact initial content for `CHANGELOG.md`:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-21

### Added
- CI pipeline with GitHub Actions (lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit)
- Dedicated CodeQL workflow for code security analysis
- Minimatch vulnerability remediation via yarn resolutions

## [0.1.0] - 2026-02-18

### Added
- Reflog MVP core: encrypted journal PWA with search, tags, and keyboard navigation
```

Change categories per the spec: Added, Changed, Deprecated, Removed, Fixed, Security.

The CD workflow's changelog guard validates this file with: `grep -qE "^## \[${VERSION}\]" CHANGELOG.md`. The `## [x.y.z]` header format is the contract between this file and the workflow.
