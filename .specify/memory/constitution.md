<!--
=== Sync Impact Report ===
Version change: 1.1.0 → 2.0.0 (MAJOR)
Modified principles:
  - I: "Privacy-First, Local-Only Data" → "Privacy-First, Device-Encrypted Data"
    (Redefined: local-only storage constraint replaced with zero-knowledge
    encryption boundary. Data may now traverse a server as ciphertext.)
  - V: "Robust Error Boundaries" expanded to include authentication
    failures and sync errors as critical subsystems.
Added sections: None (same six principles)
Removed sections: None
Other changes:
  - Architecture Boundaries: "No server-side components" ban removed.
    Replaced with constrained server-side stack (Cloudflare Workers,
    D1, Auth0) under zero-knowledge encryption rules.
  - Architecture Boundaries: Reorganized into Client and Server
    subsections with explicit permitted-use constraints.
  - AI Agent Guidelines > Security Enforcement: Updated to reflect
    zero-knowledge server constraint instead of blanket server ban.
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ No updates needed
    (Constitution Check section is dynamic; redefined principle will be
    evaluated at plan-generation time)
  - .specify/templates/spec-template.md — ✅ No updates needed
    (Spec structure is feature-agnostic; encryption constraints apply
    during planning and implementation, not specification)
  - .specify/templates/tasks-template.md — ✅ No updates needed
    (Task template is generic; zero-knowledge rules are enforced by
    the constitution at implementation time, not by the template)
  - .specify/templates/checklist-template.md — ✅ No updates needed
  - .specify/templates/agent-file-template.md — ✅ No updates needed
  - .specify/templates/commands/*.md — ✅ No command files exist
Follow-up TODOs:
  - ✅ RESOLVED (2026-02-21): plan.md Complexity Tracking section
    rewritten to reflect design trade-offs rather than violations.
    Constitution Check section shows PASS for all principles.
===========================
-->

# Reflog Constitution

## Core Principles

### I. Privacy-First, Device-Encrypted Data

All user data MUST be encrypted and decrypted exclusively on the user's
device. No unencrypted user content — including journal entries, titles,
tags, and settings — may leave the device under any circumstances.
Server-side components MUST operate as zero-knowledge services: they
store and transmit only ciphertext and MUST NOT have access to
encryption keys or plaintext data.

Unencrypted metadata transmitted to or stored on the server MUST be
minimized to the operational minimum required for sync and
authentication. The following categories define permitted metadata:

- **Permitted** (operational necessity): record IDs, server-assigned
  timestamps, record type labels, device identifiers, tombstone flags,
  encrypted payload size (for quota enforcement).
- **Prohibited**: any user-authored content (titles, bodies, tags,
  setting values) in unencrypted form.
- **Constrained**: any new metadata field added to server-side schemas
  MUST be justified as operationally necessary, documented, and
  reviewed for side-channel or metadata-analysis risk.

Authentication credentials (managed by the identity provider) MUST be
independent from vault encryption keys. Compromising the authentication
layer MUST NOT expose encrypted data.

**Rationale**: Reflog's core promise is a private journal. While data
now traverses a server for cross-device sync, the server is a blind
relay — it cannot read, analyze, or leak user content. The encryption
boundary is the device, not the network. This preserves the original
trust contract: the user's data is their own, readable only with their
vault passphrase. Minimizing unencrypted metadata further reduces the
attack surface for traffic analysis and side-channel inference.

### II. Offline-First PWA

The application MUST function fully without network connectivity. A valid
`manifest.json` is REQUIRED. The Service Worker MUST implement aggressive
caching strategies to guarantee offline-first capability. The app MUST be
installable and deliver a seamless experience across both desktop and mobile
environments.

Sync is an enhancement, not a dependency. All CRUD operations on journal
entries MUST work without connectivity. Changes made offline MUST queue
locally and sync automatically when connectivity is restored.

**Rationale**: A developer journal is useless if it requires connectivity.
Offline-first ensures the app is available exactly when developers need it —
on planes, in coffee shops, during outages. Sync adds cross-device access
but MUST NOT compromise local-first reliability.

### III. Developer-Centric Minimalism

The UI MUST default to dark mode and use monospaced fonts (Fira Code,
JetBrains Mono) for code-adjacent elements. The interface MUST feel like a
clean text editor with minimal visual noise — no unnecessary pop-ups, modals,
or navigation chrome. Global keyboard shortcuts MUST be supported:

- `Cmd/Ctrl + Enter` — Save entry
- `Cmd/Ctrl + K` — Search
- `Cmd/Ctrl + N` — New entry
- `Shift + Meta + L` — Lock vault

**Rationale**: The target audience lives in terminals and code editors. The
UI language MUST feel native to that workflow, not like a generic notes app.

### IV. Strict TypeScript & Modular Architecture

Strict TypeScript typing is REQUIRED across the entire codebase — both
client and server. The `any` type is prohibited. Clear interfaces MUST be
defined for all journal entry objects, database schemas, API contracts, and
component props. React components MUST be modular and reusable, with state
kept local to where it is consumed whenever possible. Code MUST be
self-documenting — comments are reserved for explaining *why*, not *what*,
with exceptions for cryptographic implementations and unusual architectural
decisions.

**Rationale**: A privacy-focused app with client-side encryption and a
zero-knowledge server has zero margin for type confusion or implicit data
shapes. Strict typing catches encryption schema mismatches at compile time,
not at runtime when user data is at risk.

### V. Robust Error Boundaries

Error boundaries and fallback UI MUST be implemented for all critical
subsystems: Service Worker lifecycle events, IndexedDB storage quota limits,
encryption/decryption failures, authentication failures, and sync errors.
The app MUST degrade gracefully — a crypto failure MUST NOT cause a blank
screen or silent data loss. Sync failures MUST NOT block local operations;
the app MUST remain fully functional offline when sync is unavailable.

**Rationale**: Offline-first apps with client-side encryption and
cross-device sync have more failure modes than typical SPAs. Users MUST
always understand the app's state and never lose data silently.

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

### Client (PWA)

- **Frontend Framework**: React via TanStack Start
- **UI Component Library**: Chakra UI or Mantine (one MUST be chosen and
  used consistently; minimize custom CSS)
- **Client Storage**: IndexedDB wrapped with Dexie.js, using client-side
  encryption via the Web Crypto API (AES-256-GCM). SQLite Wasm with
  encryption is an acceptable alternative only if relational query
  capabilities are required.
- **PWA Tooling**: Valid `manifest.json`, Service Worker with aggressive
  caching, installability across desktop and mobile
- **Authentication SDK**: `@auth0/auth0-react` (Auth0 SPA SDK with PKCE)

### Server (Sync API)

- **Compute**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite on edge)
- **Authentication Provider**: Auth0 (managed identity service)
- **Server Framework**: Hono (edge-native web framework)
- **JWT Verification**: `jose` (Web Crypto API-based, zero dependencies)

### Server Permitted Use

Server-side components are authorized ONLY for:

1. **User authentication and identity management** — delegated to Auth0.
   The server verifies JWTs but never handles user passwords directly.
2. **Encrypted data relay and storage** — the server stores and
   transmits encrypted blobs. It MUST NOT decrypt, inspect, index, or
   derive information from user payloads.
3. **Rate limiting and abuse protection** — request throttling, account
   creation limits, and storage quota enforcement.

No server-side component may access, derive, or infer unencrypted user
content. The server MUST treat all user payloads as opaque ciphertext.

Adding new runtime dependencies MUST be justified against this stack.
Third-party analytics, remote tracking, telemetry, or external data
routing remain prohibited under all circumstances.

## AI Agent Interaction Guidelines

These rules govern how AI coding assistants (including Claude) interact with
the Reflog codebase:

- **Context Awareness**: MUST check existing component architecture and
  database schemas before generating new files to prevent duplication.
- **Diff Precision**: When modifying existing files, MUST provide clear diffs
  or state exactly where code should be inserted or replaced.
- **Security Enforcement**: MUST NOT suggest implementing third-party
  analytics, remote tracking, telemetry, or external data routing. MUST NOT
  introduce any code path where unencrypted user content is transmitted to
  or stored on a server. Server-side code MUST treat all user payloads as
  opaque ciphertext. These are hard constraints, not preferences.
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

**Version**: 2.0.0 | **Ratified**: 2026-02-19 | **Last Amended**: 2026-02-21
