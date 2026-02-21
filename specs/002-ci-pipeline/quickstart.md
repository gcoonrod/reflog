# Quickstart: CI Pipeline for Pull Request Checks

**Branch**: `002-ci-pipeline`
**Date**: 2026-02-20

## What Gets Created

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | GitHub Actions workflow with 6 parallel jobs |
| `.nvmrc` | Pin Node.js version for CI and local dev consistency |

## What Gets Modified

| File | Change |
|------|--------|
| `vitest.config.ts` | Add coverage config (`provider: "v8"`, reporters) + CI-conditional JUnit reporter — see [plan.md#vitest-configuration-changes](./plan.md#vitest-configuration-changes) |
| `package.json` / `yarn.lock` | Add `@vitest/coverage-v8` dev dependency |

## Prerequisites

- GitHub repository with `develop` branch (already exists)
- GitHub Actions enabled on the repository (default for all repos)
- No secrets or manual configuration required

## New Dev Dependency

```bash
yarn add -D @vitest/coverage-v8
```

## Verification Steps

After implementation, verify the pipeline works:

1. **Create a test PR against `develop`**:
   ```bash
   git checkout develop
   git checkout -b test/ci-verification
   # Make a trivial change (e.g., add a comment to a file)
   git add . && git commit -m "test: verify CI pipeline"
   git push -u origin test/ci-verification
   gh pr create --base develop --title "test: CI pipeline verification" --body "Temporary PR to verify CI."
   ```

2. **Verify all 6 status checks appear** on the PR:
   - `lint`
   - `typecheck`
   - `format-check`
   - `unit-tests`
   - `e2e-tests`
   - `security`

3. **Verify all checks pass** (green checkmarks).

4. **Verify caching works** — push a second commit to the same PR and check that "Cache restored" appears in the Node.js setup step logs.

5. **Verify concurrency cancellation** — push two commits in rapid succession and verify the first run is canceled.

6. **Clean up** — close and delete the test PR/branch:
   ```bash
   gh pr close --delete-branch
   ```

## Workflow Trigger

The CI pipeline triggers on:
- `pull_request` events: `opened`, `synchronize`, `reopened`
- Target branch: `develop` only

It does **not** trigger on:
- PRs targeting `main` or other branches
- Direct pushes to `develop`
- Manual dispatch
