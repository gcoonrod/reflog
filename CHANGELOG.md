# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.7] - 2026-02-23

### Fixed
- Exclude `vault_meta` from sync pipeline — binary fields (`Uint8Array` salt, IV) lose their TypedArray type through JSON round-trip, causing PBKDF2 `deriveKey` to fail with "salt: Not a BufferSource" on unlock after sync

## [1.0.6] - 2026-02-23

### Fixed
- Extend auto-lock race condition guards to `title` and `body` fields — `body.replace` crash in EntryCard snippet and MarkdownPreview crash in entry detail when encrypted `{ciphertext, iv}` objects leak through

## [1.0.5] - 2026-02-23

### Fixed
- Crash "tags is not iterable" when auto-lock fires during in-flight render, causing encryption middleware to return raw `{ciphertext, iv}` objects instead of decrypted arrays. Added defensive `Array.isArray` guards in tags service, entries service, EntryCard, entry detail, and SearchPalette

## [1.0.4] - 2026-02-23

### Fixed
- D1 `sync_records` table stuck with old single-column PK (`id`) from initial deploy; `ON CONFLICT(user_id, id)` upsert caused 500 on sync push. Recreated table with correct composite PK `(user_id, id)`

## [1.0.3] - 2026-02-23

### Fixed
- `VITE_SYNC_API_URL` secret missing `/api/v1` path prefix, causing all sync API calls (device registration, push, pull) to hit 404

## [1.0.2] - 2026-02-23

### Fixed
- Sync API CORS rejecting requests from Cloudflare Pages deployment URL (`reflog-8t5.pages.dev`), causing sync push/pull to fail with `net::ERR_FAILED`

## [1.0.1] - 2026-02-23

### Fixed
- CI deploy build missing Vite environment variables (Auth0 domain, client ID, audience, sync API URL), causing Auth0 login redirect to fail with `undefined` domain

## [1.0.0] - 2026-02-23

### Added
- Auth0 authentication with email/password and social login (GitHub, Google)
- Sync API Worker on Cloudflare Workers with D1 database
- End-to-end encrypted cross-device sync (push/pull with LWW conflict resolution)
- Device registration and management (max 10 per user)
- Session management: distinct lock (preserves session) and logout (ends session) actions
- Lock button in header, account menu, and Shift+Meta+L keyboard shortcut
- Logout with keep/clear local data option
- Sync indicator in header (synced, syncing, offline, error states)
- Cross-tab sync coordination via Web Locks API and BroadcastChannel
- Sync scheduler with visibility change, online event, periodic, and debounced triggers
- Client-side sync queue with Dexie DBCore middleware for automatic change tracking
- Initial device setup with full pull for new devices
- Migration flow for existing local-only vaults to synced mode
- Account deletion with server-side CASCADE cleanup
- Data export (encrypted records decrypted client-side, downloaded as JSON)
- Rate limiting (IP-based and user-based) via Cloudflare Rate Limiting binding
- Request validation middleware (body size, content type, push field validation)
- Tombstone garbage collection (scheduled daily, 90-day retention)
- Storage quota enforcement (50 MB per user, 507 on exceeded)
- Auth and sync error boundaries for graceful degradation
- Worker deployment in CI with health check and atomic rollback
- Comprehensive test suite: unit, contract, integration, and E2E tests

### Changed
- Route structure reorganized under `_app` layout route for auth gating
- Dexie schema upgraded to v2 with sync_queue and sync_meta tables
- Entry type extended with syncVersion and deletedAt fields
- Entries service filters soft-deleted records
- CI workflow now deploys both Worker and Pages with rollback on failure

## [0.3.1] - 2026-02-21

### Changed
- Inline deploy job in ci.yml, eliminating separate cd.yml and unreliable workflow_run trigger
- Conditional cancel-in-progress: only cancel stale PR runs, never in-flight main deployments

### Fixed
- Spurious CD runs triggered by PR CI completions despite workflow_run branch filter

## [0.3.0] - 2026-02-21

### Added
- CD pipeline with GitHub Actions for automated deployment to Cloudflare Pages
- Version guard: skip deployment when version tag already exists
- Changelog guard: require CHANGELOG.md entry for every deployed version
- Production hosting at reflog.microcode.io with automatic SSL via Cloudflare Pages
- Git tag creation on successful deployment for release tracking

## [0.2.0] - 2026-02-21

### Added
- CI pipeline with GitHub Actions (lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit)
- Dedicated CodeQL workflow for code security analysis
- Minimatch vulnerability remediation via yarn resolutions

## [0.1.0] - 2026-02-18

### Added
- Reflog MVP core: encrypted journal PWA with search, tags, and keyboard navigation
