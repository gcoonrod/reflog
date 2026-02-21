# Quickstart: CD Pipeline and Production Hosting

**Branch**: `003-cd-pipeline`
**Date**: 2026-02-21

## What Gets Created

| File | Purpose |
|------|---------|
| `.github/workflows/cd.yml` | GitHub Actions CD workflow triggered by CI success on `main` |
| `CHANGELOG.md` | Project changelog in Keep a Changelog 1.1.0 format |

## What Gets Modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Add `push: branches: [main]` trigger + fix concurrency group for push events — see [plan.md § CI Workflow Changes](./plan.md#ci-workflow-changes) |

## Prerequisites

### Automated (handled by implementation)

- CI workflow name is exactly `'CI'` (case-sensitive match for `workflow_run`)
- CI concurrency group uses `github.ref` (works for both PR and push events)
- `CHANGELOG.md` exists with entries for all released versions

### Manual (one-time setup before first deployment)

See [plan.md § One-Time Setup](./plan.md#one-time-setup-pre-implementation) for the 6 substeps and verification commands. This is a human-only checkpoint — implementation must pause until the developer confirms completion.

## Verification Steps

After implementation and one-time setup, verify the full pipeline:

1. **Prepare a release** (on a release branch from `develop`):
   ```bash
   git checkout develop
   git checkout -b release/0.3.0
   # Bump version in package.json to 0.3.0
   # Add ## [0.3.0] entry to CHANGELOG.md
   git add . && git commit -m "chore: release 0.3.0"
   git push -u origin release/0.3.0
   ```

2. **Merge to `main`** (via PR or direct merge):
   ```bash
   gh pr create --base main --title "Release 0.3.0" --body "First CD-deployed release."
   # After approval:
   gh pr merge --merge
   ```

3. **Verify CI runs on `main` push** — check GitHub Actions for the `CI` workflow running on branch `main`.

4. **Verify CD triggers after CI** — once CI completes successfully, the `CD` workflow should start via `workflow_run`.

5. **Verify version guard passes** — the CD workflow should detect that `v0.3.0` tag does not exist and proceed.

6. **Verify changelog guard passes** — the CD workflow should find `## [0.3.0]` in CHANGELOG.md and proceed.

7. **Verify deployment succeeds** — the Cloudflare Pages deployment step should complete with a deployment URL.

8. **Verify git tag created** — a `v0.3.0` tag should appear on the repository:
   ```bash
   git fetch --tags
   git tag -l "v0.3.0"
   ```

9. **Verify site is live** — visit `https://reflog.microcode.io` and confirm the application loads with valid SSL.

10. **Verify skip behavior** — push a non-version-bump commit to `main`. The CD workflow should run but skip deployment with a step summary message: "Version 0.3.0 already deployed (tag `v0.3.0` exists)."
