# Implementation Plan: CI Pipeline for Pull Request Checks

**Branch**: `002-ci-pipeline` | **Date**: 2026-02-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-ci-pipeline/spec.md`

## Summary

Configure GitHub Actions CI workflows that trigger on PRs against `develop`, running linting, type checking, unit/integration tests (with coverage), E2E tests (with artifact upload), formatting checks, and security scanning (dependency audit + secret detection). Each check reports as an individual PR status. Security scans fail on critical/high severity only.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 22.x (LTS)
**Primary Dependencies**: GitHub Actions (runner: `ubuntu-24.04`), `yarn` v1.x (Classic)
**Storage**: N/A (CI infrastructure only)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: GitHub Actions (Ubuntu 24.04 runner)
**Project Type**: CI/CD infrastructure configuration
**Performance Goals**: Full pipeline completes within 10 minutes (SC-001)
**Constraints**: No secrets required (client-side PWA); dependency caching for speed; parallel jobs
**Scale/Scope**: Single repository, single workflow file with parallel jobs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Privacy-First, Local-Only Data | **PASS** | CI workflows do not handle user data. No analytics or telemetry added. |
| II. Offline-First PWA | **PASS** | CI validates the build (which includes SW/manifest). No changes to PWA behavior. |
| III. Developer-Centric Minimalism | **PASS** | CI is developer infrastructure. No UI changes. |
| IV. Strict TypeScript & Modular Architecture | **PASS** | CI enforces strict TypeScript via the existing `yarn typecheck` command. |
| V. Robust Error Boundaries | **PASS** | Not applicable to CI configuration files. |
| VI. Git Flow & Commit Discipline | **PASS** | Workflow triggers on PRs to `develop`, consistent with Git Flow. CI enforces the quality gate (tests, build, lint, format) that the constitution requires before merging. |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-ci-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci.yml           # Single workflow file with parallel jobs

.nvmrc                   # Pin Node.js version for CI and local dev
```

**Structure Decision**: A single workflow file with multiple parallel jobs. Each job maps to one status check (FR-010). See [research.md#R1](./research.md#r1-github-actions-workflow-structure--single-vs-multiple-files) for alternatives considered.

## Environment Variables & Secrets

### Required Environment Variables

| Variable | Scope | Source | Purpose |
|----------|-------|--------|---------|
| `CI` | All jobs | GitHub Actions (auto-set) | Signals CI environment to Playwright config (retries, workers, forbidOnly) |

### Required Secrets

**None.** The application is a client-side PWA with no backend. `yarn audit` uses the public npm advisory database. GitHub CodeQL is free for public repos and uses `GITHUB_TOKEN` (auto-provided). No manual secret configuration needed.

### Permissions

The workflow requires explicit permissions for CodeQL:

```yaml
permissions:
  contents: read
  security-events: write  # Required for CodeQL to upload SARIF results
```

## Implementation Sequence

This is the ordered task sequence. Each step references the relevant detail sections below and in [research.md](./research.md).

### Step 1: Create `.nvmrc`

Pin Node.js version for CI/local consistency. See [Node.js Version Pinning](#nodejs-version-pinning) and [research.md#R7](./research.md#r7-runner-environment--pinning-strategy).

- Create `.nvmrc` with content `22`
- No other changes needed

### Step 2: Add coverage dependency and configure Vitest

Enable coverage reporting for the unit-tests job. See [Vitest Configuration Changes](#vitest-configuration-changes) and [research.md#R6](./research.md#r6-coverage-reporting).

- `yarn add -D @vitest/coverage-v8`
- Update `vitest.config.ts` with coverage config and JUnit reporter config (see exact config below)
- Run `yarn test` locally to verify nothing breaks

### Step 3: Create workflow scaffold

Create `.github/workflows/ci.yml` with the top-level structure: trigger config, concurrency, permissions. No jobs yet. See [Workflow Skeleton](#workflow-skeleton) and [research.md#R8](./research.md#r8-concurrency-control).

- Create `.github/workflows/` directory
- Write `ci.yml` with `on:`, `concurrency:`, `permissions:` blocks
- Define the shared setup pattern (each job will repeat it)

### Step 4: Add lint, typecheck, and format-check jobs

The three simplest jobs — identical structure, different commands. See [Job 1: lint](#job-1-lint), [Job 2: typecheck](#job-2-typecheck), [Job 3: format-check](#job-3-format-check).

- Add all three jobs to `ci.yml`
- Each follows: checkout → setup-node (with cache) → `yarn install --frozen-lockfile` → run command
- Caching: `actions/setup-node@v4` with `cache: 'yarn'` — see [research.md#R2](./research.md#r2-dependency-caching-strategy)

### Step 5: Add unit-tests job

More complex — needs coverage + JUnit reporter + conditional artifact upload. See [Job 4: unit-tests](#job-4-unit-tests) and [research.md#R5](./research.md#r5-test-reporting--human-readable-artifacts).

- Add `unit-tests` job to `ci.yml`
- Run command: `yarn test -- --coverage`
- Upload `coverage/` always (for developer reference)
- Upload `test-results/` on failure only (JUnit XML + HTML report)
- Use `if: ${{ !cancelled() }}` for coverage upload, `if: ${{ failure() }}` for test report

### Step 6: Add e2e-tests job

Most complex job — needs Playwright browser installation with separate cache, build step, conditional artifact upload. See [Job 5: e2e-tests](#job-5-e2e-tests) and [Playwright Browser Caching](#playwright-browser-caching).

- Add `e2e-tests` job to `ci.yml`
- Cache Playwright browsers separately (key formula in detail section below)
- Install browsers with system deps: `npx playwright install --with-deps chromium`
- Build first: `yarn build`
- Run: `yarn test:e2e`
- Upload `playwright-report/` and `test-results/` on failure

### Step 7: Add security job

Two-part job: dependency audit + CodeQL. See [Job 6: security](#job-6-security), [research.md#R3](./research.md#r3-security-scanning--dependency-audit), [research.md#R4](./research.md#r4-security-scanning--code-analysis), and [Yarn Audit Severity Filtering](#yarn-audit-severity-filtering).

- Add `security` job to `ci.yml`
- Dependency audit: uses a `node -e` wrapper to parse `yarn audit --json` and fail only on critical/high
- CodeQL: `github/codeql-action/init@v3` → `github/codeql-action/analyze@v3` (no autobuild needed for JS)

### Step 8: Run quality gate locally

Verify all project changes pass before committing.

- `yarn typecheck && yarn lint && yarn test && yarn build && yarn test:e2e`

### Step 9: Verify via test PR

Follow [quickstart.md#verification-steps](./quickstart.md#verification-steps) to open a test PR against `develop` and validate all 6 checks run, pass, report individually, and handle caching.

---

## Workflow Skeleton

The complete top-level structure for `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened]

concurrency:
  group: ci-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read
  security-events: write  # CodeQL SARIF upload

jobs:
  # ... jobs defined in Job Details below
```

**Key points**:
- `branches: [develop]` satisfies FR-001 and FR-002 (only triggers on PRs targeting develop)
- `types:` list satisfies FR-001 (opened, synchronize covers new commits, reopened)
- `concurrency` group keyed on PR number satisfies FR-011 — see [research.md#R8](./research.md#r8-concurrency-control)
- `permissions` is set at workflow level; CodeQL requires `security-events: write`

### Pinned Action Versions

All jobs use these pinned action versions:

| Action | Version | Purpose |
|--------|---------|---------|
| `actions/checkout` | `@v4` | Check out repository code |
| `actions/setup-node` | `@v4` | Install Node.js with yarn cache support |
| `actions/upload-artifact` | `@v4` | Upload test reports and coverage |
| `actions/cache` | `@v4` | Cache Playwright browsers (e2e-tests only) |
| `github/codeql-action/init` | `@v3` | Initialize CodeQL analysis |
| `github/codeql-action/analyze` | `@v3` | Run CodeQL analysis and upload results |

### Shared Job Preamble

Every job starts with the same four steps. This is the template each job repeats (no composite action needed for 6 jobs):

```yaml
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
```

`actions/setup-node` with `cache: 'yarn'` handles cache key generation automatically (keyed on `yarn.lock` hash). See [research.md#R2](./research.md#r2-dependency-caching-strategy).

## Job Details

### Job 1: `lint`

- **FR**: FR-003
- **Runner**: `ubuntu-24.04` (FR-016 — see [research.md#R7](./research.md#r7-runner-environment--pinning-strategy))
- **Steps**: [Shared preamble](#shared-job-preamble) → `yarn lint`
- **Failure output**: ESLint violations printed to the job log (no artifact needed — violations are readable inline)

### Job 2: `typecheck`

- **FR**: FR-004
- **Steps**: [Shared preamble](#shared-job-preamble) → `yarn typecheck`
- **Failure output**: TypeScript errors printed to the job log

### Job 3: `format-check`

- **FR**: FR-007
- **Steps**: [Shared preamble](#shared-job-preamble) → `yarn format:check`
- **Failure output**: Prettier lists files with formatting violations in the job log

### Job 4: `unit-tests`

- **FR**: FR-005
- **Research**: [R5 (reporting)](./research.md#r5-test-reporting--human-readable-artifacts), [R6 (coverage)](./research.md#r6-coverage-reporting)
- **Steps**: [Shared preamble](#shared-job-preamble) → `yarn test -- --coverage`
- **Reporter config**: JUnit + default reporters configured in `vitest.config.ts` (not CLI flags — see [Vitest Configuration Changes](#vitest-configuration-changes))
- **Artifact uploads**:

  | Artifact | Path | Condition | Contains |
  |----------|------|-----------|----------|
  | `coverage-report` | `coverage/` | `if: ${{ !cancelled() }}` (always) | HTML coverage report + json-summary |
  | `test-results` | `test-results/` | `if: ${{ failure() }}` | JUnit XML for CI parsing |

### Job 5: `e2e-tests`

- **FR**: FR-006, FR-013, FR-014
- **Research**: [R2 (caching)](./research.md#r2-dependency-caching-strategy), [R5 (reporting)](./research.md#r5-test-reporting--human-readable-artifacts)
- **Steps**: [Shared preamble](#shared-job-preamble) → [Playwright browser install (with cache)](#playwright-browser-caching) → `yarn build` → `yarn test:e2e`
- **Existing CI config in `playwright.config.ts`**:
  - `retries: process.env.CI ? 2 : 0` — satisfies FR-014 (flaky test retries)
  - `workers: process.env.CI ? 1 : undefined` — prevents resource contention
  - `forbidOnly: !!process.env.CI` — prevents `.only()` from reaching CI
  - `reporter: "html"` — produces browsable HTML report
  - `trace: "on-first-retry"` — captures traces on flaky failures
  - `webServer` starts `yarn preview --port 4173` automatically
- **Artifact uploads**:

  | Artifact | Path | Condition | Contains |
  |----------|------|-----------|----------|
  | `playwright-report` | `playwright-report/` | `if: ${{ failure() }}` | HTML report (browsable test results) |
  | `e2e-traces` | `test-results/` | `if: ${{ failure() }}` | Traces, screenshots from retries |

### Job 6: `security`

- **FR**: FR-008, FR-009
- **Research**: [R3 (audit)](./research.md#r3-security-scanning--dependency-audit), [R4 (CodeQL)](./research.md#r4-security-scanning--code-analysis)
- **Two-part job** (both steps in one job, sharing a single status check):

**Part A — Dependency audit** (FR-008):

Uses `yarn audit --json` piped through a Node.js script that parses the JSON-lines output and exits non-zero only for critical/high severity findings. See [Yarn Audit Severity Filtering](#yarn-audit-severity-filtering) for the exact implementation and why the simpler `yarn audit --level high` approach doesn't work.

**Part B — CodeQL analysis** (FR-009):

```yaml
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

CodeQL for JavaScript/TypeScript does **not** require an autobuild step — it performs extractorless analysis directly on the source files. Results appear as PR annotations and are uploaded as SARIF to GitHub's Security tab. Requires `security-events: write` permission (set at workflow level).

---

## Vitest Configuration Changes

The existing `vitest.config.ts` needs two additions: coverage configuration and JUnit reporter. Configure both in the file (not via CLI flags) for reliability:

```typescript
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
    },
    reporters: process.env.CI
      ? ["default", "junit"]
      : ["default"],
    outputFile: process.env.CI
      ? { junit: "./test-results/junit.xml" }
      : undefined,
  },
});
```

**Why config instead of CLI flags**: Vitest's `--reporter` and `--outputFile` CLI flags work differently than the config equivalents. The config approach is more reliable for multi-reporter setups and avoids shell quoting issues in the workflow YAML.

**Required dependency**: `@vitest/coverage-v8` — install with `yarn add -D @vitest/coverage-v8`

## Playwright Browser Caching

Playwright browsers are ~200MB and only needed by the e2e-tests job. Cache them separately from `node_modules`:

```yaml
      - name: Get Playwright version
        id: playwright-version
        run: echo "version=$(npx playwright --version | awk '{print $2}')" >> "$GITHUB_OUTPUT"

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ steps.playwright-version.outputs.version }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium

      - name: Install Playwright system deps (on cache hit)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium
```

**Key points**:
- Cache key is the Playwright version — browsers update when Playwright updates
- `--with-deps` installs both browser binaries AND system libraries (libgbm, libgtk, etc.)
- On cache hit, browser binaries are restored but system deps still need installing (`install-deps` only, much faster)
- Only `chromium` is installed (matching the single project in `playwright.config.ts`)

## Yarn Audit Severity Filtering

**Problem**: Yarn Classic's `yarn audit --level` flag only filters the *display output*. The exit code is a bitmask of ALL found severity levels regardless of the `--level` flag. For example, `yarn audit --level critical` still exits non-zero when only moderate/high findings exist. This means `yarn audit --level high` cannot be used as a clean severity gate.

**Verified locally**: The project currently has 2 moderate + 8 high vulnerabilities (all `minimatch` ReDoS via transitive deps). `yarn audit --level critical` exits `12` (bitmask: 4+8) despite zero critical findings.

**Solution**: Capture `yarn audit --json` to a file (suppressing the non-zero exit), then parse severity counts programmatically. A pipe-based approach fails in CI because GitHub Actions uses `bash -e -o pipefail`, which terminates the pipeline before the Node.js script finishes reading when `yarn audit` exits non-zero:

```yaml
      - name: Audit dependencies (fail on critical/high only)
        run: |
          yarn audit --json > /tmp/audit.json || true
          node -e "
            const fs = require('fs');
            const lines = fs.readFileSync('/tmp/audit.json', 'utf8').split('\n');
            let summary;
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.type === 'auditSummary') summary = data.vulnerabilities;
              } catch {}
            }
            if (!summary) { console.error('No audit summary found'); process.exit(1); }
            const { high = 0, critical = 0 } = summary;
            console.log('Audit results:', JSON.stringify(summary));
            if (critical > 0 || high > 0) {
              console.error('FAIL: Found ' + critical + ' critical and ' + high + ' high severity vulnerabilities');
              process.exit(1);
            }
            console.log('PASS: No critical/high vulnerabilities');
          "
```

This satisfies the clarified requirement: fail on critical/high, pass with warnings on medium/low.

## Node.js Version Pinning

Create `.nvmrc` with `22` to pin the Node.js major version. The workflow references this file via `node-version-file: '.nvmrc'` in `actions/setup-node`, ensuring local dev and CI use the same version (FR-016). See [research.md#R7](./research.md#r7-runner-environment--pinning-strategy).

## Test Reporting Strategy

Per user requirement, test jobs produce human-readable reports saved as artifacts:

| Job | Report Type | Tool | Artifact Name | When Uploaded |
|-----|-------------|------|---------------|---------------|
| `unit-tests` | JUnit XML | Vitest (`reporters: ["junit"]`) | `test-results` | On failure |
| `unit-tests` | Coverage HTML | Vitest (`coverage.reporter: ["html"]`) | `coverage-report` | Always |
| `e2e-tests` | HTML report | Playwright (`reporter: "html"`) | `playwright-report` | On failure |
| `e2e-tests` | Traces/screenshots | Playwright (`trace: "on-first-retry"`) | `e2e-traces` | On failure |

See [research.md#R5](./research.md#r5-test-reporting--human-readable-artifacts) and [research.md#R6](./research.md#r6-coverage-reporting) for tool selection rationale.
