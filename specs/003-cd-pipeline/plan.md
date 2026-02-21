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
    ├── ci.yml           # Existing CI workflow (modified: add push trigger, fix concurrency)
    ├── codeql.yml       # Existing CodeQL workflow (unchanged)
    └── cd.yml           # New CD workflow

CHANGELOG.md             # New file (Keep a Changelog format)
```

**Structure Decision**: This feature adds a single workflow file (`cd.yml`) and a `CHANGELOG.md` to the repository root. The only existing file modified is `ci.yml` (to add a `push` trigger on `main` and fix the concurrency group for push events).

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

### Step 2: Update CI workflow for push events on main

**Modifies**: `.github/workflows/ci.yml`
**References**: [CI Workflow Changes](#ci-workflow-changes) for the complete diff, [research.md R4](./research.md#r4-ci-check-verification-in-cd-workflows) for why this change is needed

Two changes are required in `ci.yml`:

**Change 1 — Add push trigger**: Add `push: branches: [main]` to the `on:` block. Without this, CI does not run on pushes to `main`, and the CD workflow's `workflow_run` trigger will never fire.

**Change 2 — Fix concurrency group**: The current concurrency group is `ci-${{ github.event.pull_request.number }}`. Push events have no `pull_request.number` context, so this would produce the group key `ci-` (empty suffix) for all push-triggered runs, causing them to cancel each other. Change the group to use `github.ref` which works for both event types.

Target state for the top of `ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

The CI jobs themselves are unchanged — the same lint, typecheck, format-check, unit-tests, e2e-tests, and dependency-audit jobs run on both PR events and push events.

### Step 3: Create CD workflow

**Creates**: `.github/workflows/cd.yml`
**References**: [Complete cd.yml](#complete-cdyml) for the full workflow file, [research.md R1](./research.md#r1-cloudflare-pages-deployment-from-github-actions) (deployment), [R2](./research.md#r2-version-comparison-in-cd-workflows) (version guard), [R3](./research.md#r3-changelog-validation-in-github-actions) (changelog guard), [R4](./research.md#r4-ci-check-verification-in-cd-workflows) (trigger), [R6](./research.md#r6-concurrency-controls-for-cd-workflows) (concurrency)

Create `.github/workflows/cd.yml` using the complete workflow YAML in the [Complete cd.yml](#complete-cdyml) section below. That section contains the full, copy-ready file with inline comments explaining each step. The design decisions behind each section are documented in the corresponding research.md entries linked above.

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

Commit all changes, create a release branch, bump version to 0.3.0, add changelog entry, merge to `main`, and verify the full CD pipeline using the verification checklist in [quickstart.md](./quickstart.md#verification-steps). The key checkpoints are:

1. CI runs on `main` push and passes
2. CD triggers via `workflow_run` after CI completes
3. Version guard detects new version (no `v0.3.0` tag)
4. Changelog guard finds `## [0.3.0]` entry
5. Build succeeds and deployment to Cloudflare Pages completes
6. Git tag `v0.3.0` is created and pushed
7. `https://reflog.microcode.io` serves the application with valid SSL
8. A subsequent non-version-bump push skips deployment gracefully

---

## Complete cd.yml

The full `.github/workflows/cd.yml` file. Copy this verbatim, then verify against the [spec requirements mapping](#spec-requirements-mapping) below.

```yaml
name: CD

# Trigger: Chain after CI completes on main (R4)
# The workflow_run event fires when the 'CI' workflow completes on the main branch.
# The workflow name 'CI' must match ci.yml's `name:` exactly (case-sensitive).
on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
    branches: [main]

# Concurrency: Queue deployments, never cancel in-progress (R6)
# Canceling a deployment mid-upload could leave Cloudflare Pages in a partial
# state and skip the git tagging step, breaking idempotency.
concurrency:
  group: production-deploy
  cancel-in-progress: false

permissions:
  contents: write    # Push git tags after deployment
  deployments: write # Create GitHub deployment status

jobs:
  deploy:
    runs-on: ubuntu-24.04
    # Only deploy if CI passed on main. The branches filter on workflow_run
    # may not reliably filter PR-triggered CI runs, so we also check head_branch.
    if: >-
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.head_branch == 'main'

    steps:
      # Checkout main with full history and tags for version comparison (R2).
      # Explicit ref: main is required because workflow_run context may default
      # to a different commit (e.g., from a PR merge) rather than main HEAD.
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0
          fetch-tags: true

      # --- Version Guard (R2) ---
      # Compare package.json version against existing git tags.
      # If v<version> tag already exists, skip deployment (exit 0, not failure).
      # If tag does not exist, proceed. This is idempotent: if a prior deployment
      # failed before tagging, the next run re-attempts the same version.
      - name: Check version
        id: version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

          if git rev-parse "v$VERSION" >/dev/null 2>&1; then
            echo "skip=true" >> "$GITHUB_OUTPUT"
            echo "::notice::Version $VERSION already deployed (tag v$VERSION exists). Skipping."
            echo "## Deployment Skipped" >> "$GITHUB_STEP_SUMMARY"
            echo "" >> "$GITHUB_STEP_SUMMARY"
            echo "Version **$VERSION** is already deployed (tag \`v$VERSION\` exists)." >> "$GITHUB_STEP_SUMMARY"
          else
            echo "skip=false" >> "$GITHUB_OUTPUT"
            echo "New version detected: $VERSION"
          fi

      # --- Changelog Guard (R3) ---
      # Verify CHANGELOG.md exists and contains an entry for this version.
      # Uses Keep a Changelog format: ## [x.y.z] (with optional date suffix).
      # Fails the workflow with a clear error annotation if missing.
      - name: Verify changelog entry
        if: steps.version.outputs.skip == 'false'
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          if [ ! -f CHANGELOG.md ]; then
            echo "::error::CHANGELOG.md not found. Create a CHANGELOG.md with a '## [$VERSION]' section before deploying."
            echo "## Deployment Failed" >> "$GITHUB_STEP_SUMMARY"
            echo "" >> "$GITHUB_STEP_SUMMARY"
            echo "**CHANGELOG.md** file not found in repository root." >> "$GITHUB_STEP_SUMMARY"
            exit 1
          fi
          if ! grep -qE "^## \[${VERSION}\]" CHANGELOG.md; then
            echo "::error::CHANGELOG.md has no entry for version $VERSION. Add a '## [$VERSION]' section before deploying."
            echo "## Deployment Failed" >> "$GITHUB_STEP_SUMMARY"
            echo "" >> "$GITHUB_STEP_SUMMARY"
            echo "Missing CHANGELOG.md entry for version **$VERSION**." >> "$GITHUB_STEP_SUMMARY"
            exit 1
          fi
          echo "Changelog entry found for version $VERSION"

      # --- Build ---
      # Install dependencies and build the application.
      # The build output at dist/client/ is what gets deployed.
      - name: Setup Node.js
        if: steps.version.outputs.skip == 'false'
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'yarn'

      - name: Install dependencies
        if: steps.version.outputs.skip == 'false'
        run: yarn install --frozen-lockfile

      - name: Build
        if: steps.version.outputs.skip == 'false'
        run: yarn build

      # TanStack Start outputs _shell.html as the SPA entry point.
      # Cloudflare Pages requires index.html to serve the root route.
      - name: Copy SPA shell to index.html
        if: steps.version.outputs.skip == 'false'
        run: cp dist/client/_shell.html dist/client/index.html

      # --- Deploy to Cloudflare Pages (R1) ---
      # Uses the official wrangler-action which handles authentication
      # and exposes the deployment URL as a step output.
      - name: Deploy to Cloudflare Pages
        if: steps.version.outputs.skip == 'false'
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist/client --project-name=reflog --branch=main --commit-hash=${{ github.sha }}

      # --- Post-Deployment: Tag and Summary ---
      # Create a git tag for this version and push it. The tag is what the
      # version guard checks on subsequent runs to determine if deployment
      # should be skipped.
      - name: Create git tag
        if: steps.version.outputs.skip == 'false'
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          git tag "v$VERSION"
          git push origin "v$VERSION"

      - name: Write deployment summary
        if: steps.version.outputs.skip == 'false'
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          echo "## Deployment Successful" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Version**: $VERSION" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Tag**: \`v$VERSION\`" >> "$GITHUB_STEP_SUMMARY"
          echo "- **URL**: ${{ steps.deploy.outputs.deployment-url }}" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Production**: https://reflog.microcode.io" >> "$GITHUB_STEP_SUMMARY"
```

### Spec Requirements Mapping

Every step in the workflow above maps to one or more functional requirements:

| Step | Satisfies | Notes |
|------|-----------|-------|
| `workflow_run` trigger | FR-001, FR-002 | Triggers on push to main (via CI); CI success required by `if:` condition |
| `concurrency` block | FR-008 | Queues deployments; see [research.md R6](./research.md#r6-concurrency-controls-for-cd-workflows) for rationale |
| Version guard | FR-003, FR-006, SC-007 | Skips gracefully when version unchanged |
| Changelog guard | FR-004, FR-007, FR-014, SC-003 | Fails with `::error::` annotation when entry missing |
| Build step | FR-005 | `yarn build` produces `dist/client/` |
| Cloudflare Pages deploy | FR-005, FR-009, FR-010, FR-011, FR-012, SC-006 | Hosting properties provided by Cloudflare Pages |
| Git tag creation | FR-003 (idempotency) | Tag is the source of truth for "already deployed" |
| Step summaries | FR-015 | Success, skipped, and failed paths all write to `$GITHUB_STEP_SUMMARY` |
| DNS CNAME (manual) | FR-013 | Configured in Step 4 |

---

## CI Workflow Changes

The existing `ci.yml` needs two modifications:

**1. Add push trigger** ([research.md R4](./research.md#r4-ci-check-verification-in-cd-workflows)): Add `push: branches: [main]` to the `on:` block. Without this, CI does not run on pushes to `main`, and the CD workflow's `workflow_run` trigger will never fire.

**2. Fix concurrency group**: The current group `ci-${{ github.event.pull_request.number }}` is undefined for push events (no PR context). Change to `ci-${{ github.ref }}` which resolves to `ci-refs/pull/123/merge` for PRs and `ci-refs/heads/main` for pushes — unique per trigger source.

Complete diff:

```diff
 on:
   pull_request:
     branches: [develop]
     types: [opened, synchronize, reopened]
+  push:
+    branches: [main]

 concurrency:
-  group: ci-${{ github.event.pull_request.number }}
+  group: ci-${{ github.ref }}
   cancel-in-progress: true
```

The CI jobs themselves are unchanged — the same lint, typecheck, format-check, unit-tests, e2e-tests, and dependency-audit jobs run on both PR events and push events.

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
