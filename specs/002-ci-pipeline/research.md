# Research: CI Pipeline for Pull Request Checks

**Date**: 2026-02-20
**Branch**: `002-ci-pipeline`

## R1: GitHub Actions Workflow Structure — Single vs Multiple Files

**Decision**: Single workflow file (`.github/workflows/ci.yml`) with multiple parallel jobs.

**Rationale**: Each job in a single workflow appears as an individual status check on the PR (satisfying FR-010) while keeping configuration in one place. Multiple workflow files would achieve the same status check separation but add maintenance overhead — shared configuration (Node version, caching) would need to be duplicated or extracted into composite actions.

**Alternatives considered**:
- **Multiple workflow files** (one per check): More isolation but duplicated boilerplate. Better for teams with different ownership per check — overkill for a single-developer project.
- **Single job with sequential steps**: Simpler but fails FR-010 (no individual status checks) and FR-015 (no parallelism).
- **Reusable workflows**: Good for multi-repo orgs; unnecessary complexity here.

## R2: Dependency Caching Strategy

**Decision**: Use `actions/setup-node@v4` with `cache: 'yarn'` for automatic `node_modules` caching keyed on `yarn.lock` hash. Playwright browsers cached separately via `actions/cache` keyed on Playwright version.

**Rationale**: `actions/setup-node` has built-in yarn cache support that handles cache key generation and restoration automatically. Playwright browsers are large (~200MB) and only needed by the E2E job, so a separate cache avoids bloating other jobs.

**Alternatives considered**:
- **Manual `actions/cache`**: More control but `setup-node` handles the common case well.
- **No caching**: Unacceptable — `yarn install` from scratch adds 30-60s per job.
- **Cache `node_modules` directly**: Fragile — `yarn.lock` changes may not fully invalidate a stale `node_modules`.

## R3: Security Scanning — Dependency Audit

**Decision**: Use `yarn audit --json` with a Node.js wrapper script that parses JSON-lines output and exits non-zero only for critical/high severity findings.

**Rationale**: `yarn audit` is built into the package manager, requires no external tools or secrets, and outputs structured JSON. However, Yarn Classic's `--level` flag only filters *display output* — the exit code is a bitmask of ALL found severity levels regardless of the flag. Verified locally: `yarn audit --level critical` exits `12` (4=moderate + 8=high) despite zero critical findings. Therefore a wrapper script is needed to parse the `auditSummary` JSON and check only `high` + `critical` counts.

**Alternatives considered**:
- **`yarn audit --level high`** (direct): Does not work as a severity gate — exit code ignores the `--level` flag. See plan.md "Yarn Audit Severity Filtering" for details.
- **`npm audit --audit-level=high`**: npm's `--audit-level` flag correctly controls exit code behavior, but mixing package managers with an existing yarn project is fragile and can cause lockfile inconsistencies.
- **`audit-ci` package**: Purpose-built npm/yarn audit wrapper with proper severity filtering. Would work but adds a dependency for a single CI step.
- **Snyk**: Requires a Snyk account/token (secret), adds external dependency. Better for larger teams.
- **Dependabot alerts**: Complementary but operates on schedule, not per-PR.
- **OWASP Dependency-Check**: Heavy Java-based tool, slow, overkill for a JS project.

## R4: Security Scanning — Code Analysis

**Decision**: Use GitHub CodeQL via `github/codeql-action` for static code analysis. Scans JavaScript/TypeScript for security anti-patterns (hardcoded secrets, injection vulnerabilities, etc.).

**Rationale**: CodeQL is free for public repositories, natively integrated with GitHub (results appear as PR annotations), requires no external secrets, and covers OWASP top-10 patterns for JavaScript. It satisfies FR-009 without adding third-party dependencies.

**Alternatives considered**:
- **Semgrep**: Good alternative, lightweight, supports custom rules. Would require managing a separate config. Viable if CodeQL proves too slow.
- **ESLint security plugins** (`eslint-plugin-security`): Only covers a subset of patterns; not a standalone security scanner.
- **GitLeaks / TruffleHog**: Focused specifically on secrets detection. Could complement CodeQL but adds another tool.

## R5: Test Reporting — Human-Readable Artifacts

**Decision**: Vitest produces JUnit XML (for CI parsing) + HTML reports (for human reading). Playwright produces its built-in HTML report. Both upload reports as GitHub Actions artifacts on failure.

**Rationale**: The user explicitly requested "human readable reports saved for failing test runs." HTML reports from both Vitest and Playwright are self-contained, browsable, and require no external service. JUnit XML additionally enables potential future integration with GitHub's test summary rendering.

**Alternatives considered**:
- **JSON reports only**: Machine-readable but not human-friendly.
- **Third-party dashboards** (Allure, ReportPortal): Overkill for a personal project; requires hosting.
- **GitHub Actions test summary** (`dorny/test-reporter`): Adds a nice PR summary but doesn't replace downloadable artifacts.

## R6: Coverage Reporting

**Decision**: Use `@vitest/coverage-v8` with `text`, `html`, and `json-summary` reporters. The text reporter prints to CI logs, HTML is uploaded as an artifact, and json-summary enables threshold checks if needed later.

**Rationale**: The user requested coverage reports for unit/integration tests. V8 coverage provider is built into Node.js (no native compilation needed), fast, and supports all standard Istanbul reporters. The HTML report satisfies the "human readable" requirement.

**Alternatives considered**:
- **`@vitest/coverage-istanbul`**: Uses Istanbul instrumentation instead of V8. Slightly more accurate for edge cases but slower due to code transformation. V8 is preferred for speed in CI.
- **Codecov/Coveralls**: External coverage hosting services. Would require a secret token and adds external dependency. Good for teams; unnecessary for a personal project.

## R7: Runner Environment — Pinning Strategy

**Decision**: Pin to `ubuntu-24.04` (explicit version) and Node.js 22 via `.nvmrc`.

**Rationale**: `ubuntu-latest` is a moving target that can break builds when GitHub upgrades it. Pinning to `ubuntu-24.04` ensures reproducibility (FR-016). Node.js 22 is the current LTS matching the developer's local environment (v22.21.0). The `.nvmrc` file ensures local dev and CI use the same version.

**Alternatives considered**:
- **`ubuntu-latest`**: Convenient but non-reproducible. A breaking change in the runner image can fail CI without code changes.
- **Container-based jobs**: Maximum reproducibility but adds complexity and slower startup. Overkill here.

## R8: Concurrency Control

**Decision**: Use GitHub Actions `concurrency` group keyed on PR number with `cancel-in-progress: true`.

**Rationale**: When a developer pushes multiple commits in quick succession, only the latest commit matters. Canceling stale runs saves GitHub Actions minutes and provides faster feedback (FR-011).

**Alternatives considered**:
- **No concurrency control**: Wastes CI minutes running stale commits.
- **Queue-based**: Useful for deployment workflows but unnecessary for CI checks.
