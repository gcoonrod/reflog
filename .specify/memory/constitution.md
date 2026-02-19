<!--
=== Sync Impact Report ===
Version change: 1.0.0 → 1.1.0
Modified principles:
  - None renamed or redefined
Added sections:
  - Principle VI: Git Flow & Commit Discipline (new core principle)
Removed sections: None
Other changes:
  - Governance > Compliance Review: Updated "Principles I-V" → "Principles I-VI"
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ No updates needed
    (Constitution Check section is dynamic; new principle will be
    evaluated at plan-generation time)
  - .specify/templates/spec-template.md — ✅ No updates needed
    (Spec structure is feature-agnostic; branching/commit rules
    apply during implementation, not specification)
  - .specify/templates/tasks-template.md — ✅ No updates needed
    (Line 249 already states "Commit after each task or logical group"
    which is consistent with VI's "commit regularly" rule; the quality
    gate constraint is enforced by the constitution, not the template)
  - .specify/templates/checklist-template.md — ✅ No updates needed
  - .specify/templates/agent-file-template.md — ✅ No updates needed
  - .specify/templates/commands/*.md — ✅ No command files exist
Follow-up TODOs: None
===========================
-->

# Reflog Constitution

## Core Principles

### I. Privacy-First, Local-Only Data

All user data MUST be stored exclusively on the user's device. Client-side
encryption via the Web Crypto API or `dexie-encrypted` is REQUIRED for all
data at rest. No third-party analytics, remote tracking, telemetry, or
external data routing is permitted under any circumstances.

**Rationale**: Reflog's core promise is "local commits" — a private journal
that never phones home. Violating this principle fundamentally breaks the
product's trust contract with its users.

### II. Offline-First PWA

The application MUST function fully without network connectivity. A valid
`manifest.json` is REQUIRED. The Service Worker MUST implement aggressive
caching strategies to guarantee offline-first capability. The app MUST be
installable and deliver a seamless experience across both desktop and mobile
environments.

**Rationale**: A developer journal is useless if it requires connectivity.
Offline-first ensures the app is available exactly when developers need it —
on planes, in coffee shops, during outages.

### III. Developer-Centric Minimalism

The UI MUST default to dark mode and use monospaced fonts (Fira Code,
JetBrains Mono) for code-adjacent elements. The interface MUST feel like a
clean text editor with minimal visual noise — no unnecessary pop-ups, modals,
or navigation chrome. Global keyboard shortcuts MUST be supported:

- `Cmd/Ctrl + Enter` — Save entry
- `Cmd/Ctrl + K` — Search
- `Cmd/Ctrl + N` — New entry

**Rationale**: The target audience lives in terminals and code editors. The
UI language MUST feel native to that workflow, not like a generic notes app.

### IV. Strict TypeScript & Modular Architecture

Strict TypeScript typing is REQUIRED across the entire codebase. The `any`
type is prohibited. Clear interfaces MUST be defined for all journal entry
objects, database schemas, and component props. React components MUST be
modular and reusable, with state kept local to where it is consumed whenever
possible. Code MUST be self-documenting — comments are reserved for
explaining *why*, not *what*, with exceptions for cryptographic
implementations and unusual architectural decisions.

**Rationale**: A privacy-focused app with client-side encryption has zero
margin for type confusion or implicit data shapes. Strict typing catches
encryption schema mismatches at compile time, not at runtime when user data
is at risk.

### V. Robust Error Boundaries

Error boundaries and fallback UI MUST be implemented for all critical
subsystems: Service Worker lifecycle events, IndexedDB storage quota limits,
and encryption/decryption failures. The app MUST degrade gracefully — a
crypto failure MUST NOT cause a blank screen or silent data loss.

**Rationale**: Offline-first apps with client-side encryption have more
failure modes than typical SPAs. Users MUST always understand the app's state
and never lose data silently.

### VI. Git Flow & Commit Discipline

The project MUST use the Git Flow branching strategy:

- **`main`**: Production-ready releases only. Merges from `release/*` or
  `hotfix/*` branches. Every merge MUST be tagged with a version number.
- **`develop`**: Integration branch for the next release. All feature work
  merges here first.
- **`feature/*`**: Branched from `develop` for new features. Named
  descriptively (e.g., `feature/encrypted-search`). Merged back to
  `develop` via pull request.
- **`release/*`**: Branched from `develop` when preparing a release.
  Bug fixes only — no new features. Merged to both `main` and `develop`
  on completion.
- **`hotfix/*`**: Branched from `main` for critical production fixes.
  Merged to both `main` and `develop` on completion.

Commits MUST be made regularly — after each completed task or logical unit
of work. However, no commit is permitted unless **all** of the following
pass locally:

1. **All tests** pass (unit, integration, contract — whichever exist).
2. **Build** completes without errors.
3. **Linting** reports zero violations.
4. **Formatting** conforms to project standards (auto-format before commit).

A failing check is a hard block. Developers MUST NOT use `--no-verify`,
skip hooks, or bypass the quality gate for any reason. If a check is
broken, fix it before committing.

**Rationale**: Git Flow provides predictable release management for a
privacy-sensitive app where broken builds risk data-loss bugs reaching
users. The commit quality gate ensures `develop` and `main` are always
in a deployable state — no "WIP" or "fix later" commits that rot.

## Architecture & Tech Stack Boundaries

The following technology choices are binding and MUST NOT be substituted
without a constitution amendment:

- **Frontend Framework**: React via TanStack Start
- **UI Component Library**: Chakra UI or Mantine (one MUST be chosen and
  used consistently; minimize custom CSS)
- **Database/Storage**: IndexedDB wrapped with Dexie.js, using client-side
  encryption. SQLite Wasm with encryption is an acceptable alternative only
  if relational query capabilities are required.
- **PWA Tooling**: Valid `manifest.json`, Service Worker with aggressive
  caching, installability across desktop and mobile
- **Encryption**: Web Crypto API or `dexie-encrypted`

Adding new runtime dependencies MUST be justified against this stack. No
server-side components, backend services, or cloud storage integrations are
permitted.

## AI Agent Interaction Guidelines

These rules govern how AI coding assistants (including Claude) interact with
the Reflog codebase:

- **Context Awareness**: MUST check existing component architecture and
  database schemas before generating new files to prevent duplication.
- **Diff Precision**: When modifying existing files, MUST provide clear diffs
  or state exactly where code should be inserted or replaced.
- **Security Enforcement**: MUST NOT suggest implementing third-party
  analytics, remote tracking, or external data routing under any
  circumstances. This is a hard constraint, not a preference.
- **Conciseness**: Provide direct, working code solutions. Skip pleasantries
  and lengthy explanations unless specifically asked for a breakdown.
- **Commit Compliance**: MUST verify all tests, build, linting, and
  formatting pass before creating any commit. MUST follow Git Flow branch
  naming conventions when creating branches.

## Governance

This constitution is the highest-authority document for the Reflog project.
All features, pull requests, and code reviews MUST verify compliance with
these principles.

### Amendment Procedure

1. Proposed amendments MUST be documented with rationale.
2. Changes MUST be versioned using semantic versioning:
   - **MAJOR**: Principle removal, redefinition, or backward-incompatible
     governance change.
   - **MINOR**: New principle added or existing principle materially expanded.
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements.
3. All dependent templates (plan, spec, tasks) MUST be checked for
   consistency after any amendment.
4. A Sync Impact Report MUST be included as an HTML comment at the top of
   this file after each amendment.

### Compliance Review

- Every feature spec MUST include a Constitution Check gate before
  implementation begins.
- Code reviews MUST flag violations of Principles I-VI.
- Complexity beyond what is strictly required MUST be justified in writing.

**Version**: 1.1.0 | **Ratified**: 2026-02-19 | **Last Amended**: 2026-02-19
