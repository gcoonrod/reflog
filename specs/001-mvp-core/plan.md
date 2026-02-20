# Implementation Plan: Reflog MVP Core

**Branch**: `001-mvp-core` | **Date**: 2026-02-19 | **Updated**: 2026-02-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mvp-core/spec.md`

## Summary

Build the core MVP of Reflog — a privacy-first, offline-capable PWA for
developers to journal in Markdown. The app uses TanStack Start v1.161+ as a
Vite plugin (SPA mode) with Mantine v8 UI, stores all data in encrypted
IndexedDB via Dexie.js v4.3 with DBCore middleware encryption (Web Crypto
API), and provides full-text search via MiniSearch v7.2 operating on
decrypted in-memory data. All user data is encrypted at rest with a
user-defined passphrase and never transmitted over the network.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`), React 19
**Primary Dependencies**: TanStack Start v1.161+ (Vite plugin, SPA mode),
TanStack Router v1.161+, Mantine v8, Dexie.js v4.3, CodeMirror 6 (via
@uiw/react-codemirror), react-markdown v10, MiniSearch v7.2, vite-plugin-pwa
v1.2
**Build**: Vite 7.3+ (TanStack Start is a Vite plugin; no Vinxi dependency)
**Config**: `vite.config.ts` (not `app.config.ts`)
**Storage**: IndexedDB via Dexie.js with custom AES-256-GCM encryption via
DBCore middleware (`db.use()`) using Web Crypto API + PBKDF2 key derivation
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (PWA) — desktop and mobile browsers
**Project Type**: Single project (frontend-only SPA, no backend)
**Performance Goals**: <3s load, <1s search over 1,000 entries, <5s new
entry flow
**Constraints**: Offline-capable, zero network data transmission, all data
encrypted at rest, auto-lock on inactivity (5min) and visibility loss
**Scale/Scope**: Single user, single device, up to 1,000+ entries, ~8 views

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Privacy-First, Local-Only Data | **PASS** | All data in IndexedDB, encrypted with AES-256-GCM via Web Crypto API. Zero network requests for user content. No analytics or tracking. |
| II. Offline-First PWA | **PASS** | `vite-plugin-pwa` with Workbox precaching. `manifest.json` for installability. All features work offline (data is local). |
| III. Developer-Centric Minimalism | **PASS** | Mantine dark theme default, Fira Code / JetBrains Mono fonts, Cmd+K/N/Enter shortcuts, minimal chrome via AppShell. |
| IV. Strict TypeScript & Modular Architecture | **PASS** | TypeScript strict mode enforced. Typed interfaces for all entities, services, and props. Modular component structure with local state. |
| V. Robust Error Boundaries | **PASS** | React error boundaries at root and per-subsystem. Fallback UI for crypto failures, storage quota, SW lifecycle. |
| VI. Git Flow & Commit Discipline | **PASS** | Git Flow branches. Commit gate: `typecheck && lint && test && build`. No `--no-verify`. |

**Post-design re-check**: All principles still pass. No violations to justify.

## Implementation Phases

Phases are ordered by dependency. Each phase lists the files to create/modify,
the reference documents containing implementation details, and a verification
checkpoint that must pass before proceeding.

**Dependency graph**:

```text
Phase 0: Scaffold ──► Phase 1: Types ──► Phase 2: Crypto ──► Phase 3: DB + Encryption
                                                                       │
                                                              Phase 4: Vault Service
                                                                       │
                                                              Phase 5: Vault UI (Setup/Unlock)
                                                                       │
                                                              Phase 6: Entry CRUD
                                                                       │
                                                    ┌──────────────────┼──────────────────┐
                                                    │                  │                  │
                                           Phase 7: Timeline   Phase 8: Editor    Phase 10: Tags
                                                    │                  │                  │
                                                    │          Phase 9: Drafts            │
                                                    │                  │                  │
                                                    └──────────────────┼──────────────────┘
                                                                       │
                                                             Phase 11: Search
                                                                       │
                                                             Phase 12: Auto-Lock
                                                                       │
                                                             Phase 13: Keyboard Shortcuts
                                                                       │
                                                             Phase 14: PWA + Polish
                                                                       │
                                                             Phase 15: E2E Tests
```

---

### Phase 0: Project Scaffolding

**Depends on**: Nothing (first step)

**Goal**: Working dev server with Mantine dark theme rendering on an empty page.

**Files to create**:
- `package.json` — all dependencies from [research.md Version Matrix](./research.md)
- `vite.config.ts` — TanStack Start + Vite React + PWA plugin
- `tsconfig.json` — TypeScript strict mode, no `any`, path aliases
- `postcss.config.cjs` — Mantine PostCSS preset + breakpoint vars
- `.eslintrc.cjs` / `eslint.config.js` — ESLint config
- `.prettierrc` — Prettier config
- `vitest.config.ts` — Vitest setup
- `playwright.config.ts` — Playwright setup

**References**:
- [research.md §1](./research.md) — `vite.config.ts` example with
  `tanstackStart({ spa: { enabled: true } })`, `viteReact()`, `VitePWA()`
- [research.md §2](./research.md) — Mantine style imports, PostCSS setup,
  `postcss-preset-mantine` + `postcss-simple-vars`
- [research.md §6](./research.md) — Vitest rationale
- [research.md §7](./research.md) — `vite-plugin-pwa` config, TypeScript
  `compilerOptions.types` for virtual module types
- [research.md Version Matrix](./research.md) — exact dependency versions

**Verification**:
- `pnpm dev` starts without errors on `http://localhost:3000`
- `pnpm typecheck` passes
- `pnpm lint` passes
- Empty page renders with Mantine dark theme background

---

### Phase 1: Type Definitions

**Depends on**: Phase 0

**Goal**: All entity types and service interface contracts compiled and type-checked.

**Files to create**:
- `src/types/index.ts` — `Entry`, `VaultMeta`, `Setting` interfaces + all
  input/result types (`CreateEntryInput`, `UpdateEntryInput`, `SearchResult`,
  `TagWithCount`, `KeyboardShortcut`)

**References**:
- [contracts/service-interfaces.ts](./contracts/service-interfaces.ts) —
  **copy entity types and input types directly** (lines 12–35 for entities,
  lines 67–77 for input types, lines 143–151 for SearchResult, lines 190–193
  for TagWithCount, lines 223–232 for KeyboardShortcut)
- [data-model.md Tables](./data-model.md) — field types and constraints for
  cross-checking

**Verification**:
- `pnpm typecheck` passes
- All interfaces importable from `@/types`

---

### Phase 2: Crypto Service

**Depends on**: Phase 1 (uses no entity types, but Phase 0 tooling must work)

**Goal**: Pure utility functions for key derivation, encrypt, and decrypt — fully
tested with no database dependency.

**Files to create**:
- `src/services/crypto.ts` — implements `CryptoUtils` interface
- `tests/unit/crypto.test.ts`

**References**:
- [contracts/service-interfaces.ts `CryptoUtils`](./contracts/service-interfaces.ts)
  — `deriveKey()`, `generateSalt()`, `encrypt()`, `decrypt()` signatures
  (lines 269–298)
- [data-model.md "Key Derivation"](./data-model.md) — PBKDF2 parameters:
  100,000 iterations, SHA-256, AES-GCM 256-bit, non-extractable CryptoKey
- [data-model.md "Field Encryption"](./data-model.md) — AES-GCM with random
  12-byte IV, TextEncoder/TextDecoder for string ↔ Uint8Array

**Verification**:
- Unit tests pass: derive key from passphrase + salt, encrypt a string,
  decrypt back to original, wrong key fails decryption
- `pnpm typecheck && pnpm test` passes

---

### Phase 3: Database Schema + Encryption Middleware

**Depends on**: Phase 2 (crypto service provides encrypt/decrypt functions)

**Goal**: Dexie database with tables defined and DBCore middleware that
transparently encrypts/decrypts `title`, `body`, `tags` fields on entries.

**Files to create**:
- `src/db/schema.ts` — Dexie database definition with `version(1).stores()`
- `src/db/encryption.ts` — DBCore middleware via `db.use()`
- `src/db/index.ts` — database instance export (applies middleware)
- `tests/integration/db-encryption.test.ts`

**References**:
- [data-model.md "Tables"](./data-model.md) — schema for `vault_meta`,
  `entries`, `settings` including indexes: `id` (PK), `status`, `createdAt`,
  `updatedAt`, `[status+createdAt]` compound index
- [research.md §3 "Encryption via DBCore middleware pattern"](./research.md) —
  code example for `db.use()` with `mutate()`, `get()`, `getMany()` overrides
- [research.md §3 "TypeScript pattern"](./research.md) — `EntityTable<T, 'id'>`
  cast pattern for typed tables
- [data-model.md "Field Encryption"](./data-model.md) — which fields are
  encrypted (title, body, tags) vs. plaintext (id, createdAt, updatedAt, status)

**Implementation notes**:
- The encryption middleware needs access to the derived CryptoKey. Since the key
  only exists in memory after vault unlock, the middleware must accept a key
  reference (e.g., a getter function or a module-level variable) and skip
  encryption when no key is set (for `vault_meta` and pre-unlock operations).
- The `settings` table also has encrypted values — the middleware should handle
  both `entries` and `settings` tables.

**Verification**:
- Integration tests pass: write an entry → read raw IndexedDB → confirm
  `title`/`body`/`tags` are ciphertext → read via Dexie → confirm plaintext
- `vault_meta` writes/reads work without encryption
- `pnpm typecheck && pnpm test` passes

---

### Phase 4: Vault Service

**Depends on**: Phase 3 (needs DB + crypto for key storage and verification)

**Goal**: Complete vault lifecycle — setup, unlock, lock, verify — with the
derived CryptoKey managed in memory.

**Files to create**:
- `src/services/vault.ts` — implements `VaultService` interface
- `src/hooks/useVault.ts` — React hook exposing vault state + actions
- `tests/unit/vault.test.ts`

**References**:
- [contracts/service-interfaces.ts `VaultService`](./contracts/service-interfaces.ts)
  — `isSetUp()`, `setup()`, `unlock()`, `lock()`, `isUnlocked()` (lines 38–63)
- [data-model.md "Vault Lifecycle"](./data-model.md) — state machine:
  No Vault → Locked → Unlocked → (auto-lock) → Locked
- [data-model.md "Passphrase Verification"](./data-model.md) — encrypt
  `"reflog-vault-check"` on setup, decrypt to verify on unlock
- [data-model.md `vault_meta` table](./data-model.md) — `salt`,
  `verificationBlob`, `iv`, `createdAt` fields

**Implementation notes**:
- `setup()` generates a random salt, derives key, encrypts the sentinel string,
  stores `vault_meta` record, and sets the module-level CryptoKey reference
  (the same one the encryption middleware reads).
- `lock()` must null out the CryptoKey reference — this immediately makes the
  encryption middleware unable to decrypt, effectively "locking" data.
- `useVault` hook should use React context or a module-level store so all
  components can check `isUnlocked()` for route guards.

**Verification**:
- Unit tests: setup creates `vault_meta` with salt + blob, unlock with correct
  passphrase returns key, unlock with wrong passphrase throws, lock nulls key,
  `isSetUp()` returns correct boolean
- `pnpm typecheck && pnpm test` passes

---

### Phase 5: App Shell + Vault UI

**Depends on**: Phase 4 (vault service for setup/unlock logic)

**Goal**: User can visit the app, create a passphrase on first run, unlock on
subsequent visits, and see an empty timeline placeholder.

**Files to create**:
- `src/routes/__root.tsx` — Mantine `AppShell` + `MantineProvider` + error
  boundary wrapper
- `src/routes/index.tsx` — redirect to `/setup` (no vault), `/unlock` (locked),
  or `/timeline` (unlocked)
- `src/routes/setup.tsx` — passphrase creation with 8-char minimum + data loss
  warning
- `src/routes/unlock.tsx` — passphrase entry with error display
- `src/components/vault/SetupWizard.tsx`
- `src/components/vault/UnlockScreen.tsx`
- `src/components/common/ErrorBoundary.tsx`
- `src/theme/index.ts` — Mantine theme override (dark, monospace fonts)
- `src/router.tsx` — TanStack Router instance

**References**:
- [research.md §2 "AppShell"](./research.md) — `AppShell` component with
  header/navbar/main sub-components, responsive configuration
- [research.md §2 "Spotlight API"](./research.md) — add `<Spotlight />` to root
  layout now (wired to search later in Phase 11)
- [research.md §2 "Required style imports"](./research.md) — import
  `@mantine/core/styles.css`, `@mantine/spotlight/styles.css`,
  `@mantine/notifications/styles.css` in root
- [research.md §2 "Theme configuration"](./research.md) — `defaultColorScheme:
  'dark'`, `fontFamilyMonospace` override
- [research.md §1 "File-based routing"](./research.md) — `__root.tsx`,
  `index.tsx` conventions, `src/router.tsx` + `src/routeTree.gen.ts`
- [spec.md FR-002](./spec.md) — passphrase minimum 8 chars, no complexity rules
- [spec.md FR-003](./spec.md) — require passphrase on each launch
- [spec.md FR-015](./spec.md) — warn about irrecoverable data on setup
- [spec.md US1 scenarios 1, 2, 10](./spec.md)

**Verification**:
- First visit → setup screen with passphrase input + data loss warning
- Create passphrase (≥8 chars) → redirected to empty timeline placeholder
- Close and reopen → unlock screen
- Wrong passphrase → error message, no data revealed
- Short passphrase (<8 chars) → validation error on setup
- `pnpm typecheck && pnpm test && pnpm build` passes

---

### Phase 6: Entry CRUD Service

**Depends on**: Phase 3 (encrypted DB), Phase 4 (vault for CryptoKey)

**Goal**: Full create/read/update/delete for entries via service layer, with
encrypted storage transparent to callers.

**Files to create**:
- `src/services/entries.ts` — implements `EntryService` interface
- `src/utils/date.ts` — ISO date helpers, human-readable default title format
- `src/hooks/useEntries.ts` — React hook using `useLiveQuery` for reactive lists
- `tests/unit/entries.test.ts`
- `tests/integration/entry-crud.test.ts`

**References**:
- [contracts/service-interfaces.ts `EntryService`](./contracts/service-interfaces.ts)
  — `create()`, `getById()`, `list()`, `update()`, `delete()`, plus draft
  methods (lines 80–139)
- [data-model.md "Entry Lifecycle"](./data-model.md) — New → Published,
  Published → Edited → Published, Published → Deleted (permanent)
- [data-model.md `entries` table](./data-model.md) — UUID for `id`, compound
  index `[status+createdAt]` for listing published entries newest-first
- [research.md §3 "React integration"](./research.md) — `dexie-react-hooks`
  `useLiveQuery()` for reactive query results
- [spec.md FR-008](./spec.md) — full CRUD
- [spec.md FR-017](./spec.md) — auto-populate title with current date/time

**Implementation notes**:
- `create()` should generate a UUID (`crypto.randomUUID()`), set `status:
  "published"`, auto-populate title via `date.ts` if not provided.
- `list()` should query using the compound index: `db.entries.where(
  '[status+createdAt]').between(['published', Dexie.minKey], ['published',
  Dexie.maxKey]).reverse().toArray()`.
- `useEntries` hook wraps `useLiveQuery` so the timeline auto-updates when
  entries change.

**Verification**:
- Integration tests: create entry → list returns it → update title → list
  shows updated → delete → list is empty
- Default title is current date/time
- Draft entries (`status: "draft"`) do NOT appear in `list()` results
- `pnpm typecheck && pnpm test` passes

---

### Phase 7: Timeline View

**Depends on**: Phase 5 (app shell + routes), Phase 6 (entry CRUD for data)

**Goal**: After unlocking, user sees entries in reverse-chronological order.
Empty state displayed when no entries exist.

**Files to create**:
- `src/routes/timeline.tsx` — main timeline route
- `src/components/timeline/EntryList.tsx` — renders list of entry cards
- `src/components/timeline/EntryCard.tsx` — single entry summary (title, date,
  tag badges, preview snippet)
- `src/components/timeline/EmptyState.tsx` — "No entries yet" with CTA

**References**:
- [spec.md FR-007](./spec.md) — reverse-chronological timeline
- [spec.md US1 scenarios 6, 7](./spec.md) — save returns to timeline, select
  entry shows full content
- [data-model.md compound index](./data-model.md) — `[status+createdAt]` for
  efficient "published entries, newest first" query

**Verification**:
- After unlock with existing entries: timeline shows them newest-first
- After unlock with no entries: empty state with prompt to create first entry
- Selecting an entry navigates to `/entry/:id` (view route, built in Phase 8)
- `pnpm typecheck && pnpm build` passes

---

### Phase 8: Markdown Editor + Entry Views

**Depends on**: Phase 6 (entry CRUD), Phase 7 (timeline to navigate back to)

**Goal**: User can create new entries in a CodeMirror editor, toggle to Markdown
preview, save to timeline, view rendered entries, and edit existing entries.

**Files to create**:
- `src/components/editor/MarkdownEditor.tsx` — CodeMirror 6 wrapper with
  Markdown language support and dark theme
- `src/components/editor/MarkdownPreview.tsx` — react-markdown with
  rehype-highlight
- `src/components/editor/EditorTabs.tsx` — Mantine Tabs for Write/Preview toggle
- `src/routes/entry/new.tsx` — new entry route with editor + save action
- `src/routes/entry/$id.tsx` — view entry with rendered Markdown
- `src/routes/entry/$id.edit.tsx` — edit entry route with editor pre-filled

**References**:
- [research.md §5 "Editor setup"](./research.md) — `@uiw/react-codemirror`
  usage with `markdown()` extension, `oneDark` theme, `useMemo` for extensions
- [research.md §5 "Preview rendering"](./research.md) — `react-markdown` with
  `remarkGfm` and `rehypeHighlight` plugins
- [research.md §5 "Keyboard shortcut coexistence"](./research.md) —
  `EditorView.domEventHandlers` to pass Cmd+K, Cmd+N through to app handlers
- [research.md §5 "Performance notes"](./research.md) — memoize extensions,
  debounce onChange, consider `basicSetup={false}`
- [research.md §2 "Tabs"](./research.md) — Mantine `Tabs` with `Tabs.List`,
  `Tabs.Tab`, `Tabs.Panel`
- [spec.md FR-001](./spec.md) — Markdown editor with toggle, syntax highlighting
- [spec.md FR-017](./spec.md) — auto-populate title with date/time
- [spec.md US1 scenarios 3, 4, 5, 6, 7, 8](./spec.md)

**Implementation notes**:
- The CodeMirror extension for keyboard pass-through must be added to the
  extensions array so Cmd+K (search) and Cmd+N (new entry) bubble up even when
  the editor is focused.
- Editor state must persist across Write/Preview tab toggles — do NOT unmount
  the CodeMirror instance when switching to preview.
- Import `highlight.js` CSS theme for code block syntax highlighting in preview
  (e.g., `import 'highlight.js/styles/github-dark.css'`).

**Verification**:
- New entry: Cmd+N or button → editor with date title → type Markdown → toggle
  to preview → rendered with syntax-highlighted code blocks → toggle back →
  content preserved → save → back on timeline → entry visible
- View entry: click entry in timeline → rendered Markdown displayed
- Edit entry: from view → edit button → editor with content → modify → save →
  updated in timeline
- `pnpm typecheck && pnpm build` passes

---

### Phase 9: Draft Auto-Save

**Depends on**: Phase 8 (editor must exist to save drafts from)

**Goal**: Editor content auto-saved as encrypted draft on navigate-away or
auto-lock. Drafts restored when user returns to editor.

**Files to modify**:
- `src/services/entries.ts` — implement `saveDraft()`, `getDraft()`,
  `publishDraft()`, `discardDraft()` methods
- `src/hooks/useEntries.ts` — expose draft operations
- `src/components/editor/MarkdownEditor.tsx` — add auto-save on unmount / route
  change
- `src/routes/entry/new.tsx` — check for existing draft on mount, restore if
  found

**References**:
- [contracts/service-interfaces.ts `EntryService`](./contracts/service-interfaces.ts)
  — `saveDraft()`, `getDraft()`, `publishDraft()`, `discardDraft()` signatures
  (lines 117–139)
- [data-model.md "Entry Lifecycle"](./data-model.md) — Draft state: created by
  auto-save, not visible in timeline, one draft per entry (new or existing)
- [spec.md FR-018](./spec.md) — auto-save on navigate-away, auto-lock, app close
- [spec.md FR-019](./spec.md) — restore most recent draft
- [spec.md US1 scenarios 13, 14, 15](./spec.md)

**Implementation notes**:
- Use the router's `beforeLoad` or component `useEffect` cleanup to trigger
  auto-save when leaving the editor route.
- For "new entry" drafts, use a sentinel ID (e.g., `"draft-new"`) so there is
  at most one unsaved new-entry draft at a time.
- For "edit existing" drafts, store with the original entry's ID so the draft
  is associated with the correct entry.
- `publishDraft()` should change `status` from `"draft"` to `"published"` and
  update `updatedAt`.

**Verification**:
- Type in editor → navigate away → return → draft restored
- Type in editor → auto-lock fires (Phase 12) → unlock → return to editor →
  draft restored
- Save draft → explicit save → entry published, draft cleared
- Drafts never appear in timeline
- `pnpm typecheck && pnpm test` passes

---

### Phase 10: Tag System

**Depends on**: Phase 6 (entry CRUD), Phase 8 (editor for tag input)

**Goal**: Tags extracted from body and explicit input, normalized, displayed as
badges, and filterable in the timeline.

**Files to create**:
- `src/services/tags.ts` — implements `TagService` interface
- `src/hooks/useTags.ts` — React hook for tag state + filtering
- `src/components/tags/TagBadge.tsx` — single tag as Mantine `Badge`
- `src/components/tags/TagFilterBar.tsx` — tag list for filtering timeline
- `src/components/tags/TagInput.tsx` — dedicated tag input field for editor
- `tests/unit/tags.test.ts`

**Files to modify**:
- `src/components/editor/MarkdownEditor.tsx` — add `TagInput` below editor
- `src/routes/timeline.tsx` — add `TagFilterBar`, wire filter to entry list
- `src/components/timeline/EntryCard.tsx` — show tag badges

**References**:
- [contracts/service-interfaces.ts `TagService`](./contracts/service-interfaces.ts)
  — `extractFromBody()`, `normalize()`, `mergeTags()`, `getAllWithCounts()`
  (lines 195–219)
- [data-model.md "Tag Normalization Rules"](./data-model.md) — 6-step
  normalization: strip `#`, lowercase, hyphens for spaces/underscores,
  `[a-z0-9-]` only, collapse hyphens, trim
- [research.md §2 "Badge"](./research.md) — Mantine `Badge` variants
- [spec.md FR-010](./spec.md) — inline `#tag-name` + dedicated input
- [spec.md FR-011](./spec.md) — filter timeline by tags
- [spec.md US3 all scenarios](./spec.md)

**Implementation notes**:
- `extractFromBody()` needs a regex that finds `#tag-name` patterns in Markdown
  but does NOT match inside code blocks, URLs, or headings. A simple regex like
  `/(?:^|\s)#([a-zA-Z0-9][\w-]*)/g` works for MVP; false positives inside code
  blocks are acceptable for MVP scope.
- `getAllWithCounts()` must iterate all published entries and aggregate tag
  frequencies (since tags are encrypted, this runs on decrypted in-memory data).

**Verification**:
- Unit tests: normalization rules match all examples in data-model.md
- Write entry with `#bug-hunt` in body → tag appears on entry card
- Add tag via dedicated input → also appears
- Filter timeline by tag → only matching entries shown
- Clear filter → all entries shown
- Tag list shows counts
- `pnpm typecheck && pnpm test` passes

---

### Phase 11: Full-Text Search

**Depends on**: Phase 4 (vault unlock triggers index build), Phase 6 (entries
to index), Phase 5 (Spotlight component in root layout)

**Goal**: Cmd+K opens search palette, typing queries MiniSearch over decrypted
entries, selecting a result navigates to entry view.

**Files to create**:
- `src/services/search.ts` — implements `SearchService` interface
- `src/hooks/useSearch.ts` — React hook for search state + debounced query
- `src/components/search/SearchPalette.tsx` — Mantine Spotlight wired to
  MiniSearch results
- `tests/unit/search.test.ts`

**Files to modify**:
- `src/routes/__root.tsx` — wire `SearchPalette` into root layout
- `src/services/vault.ts` — on unlock: load all entries, call
  `searchService.buildIndex(entries)`; on lock: call
  `searchService.clearIndex()`
- `src/services/entries.ts` — on create: `searchService.addToIndex(entry)`;
  on update: `searchService.updateInIndex(entry)`; on delete:
  `searchService.removeFromIndex(id)`

**References**:
- [contracts/service-interfaces.ts `SearchService`](./contracts/service-interfaces.ts)
  — `buildIndex()`, `search()`, `addToIndex()`, `updateInIndex()`,
  `removeFromIndex()`, `clearIndex()` (lines 153–186)
- [research.md §4](./research.md) — MiniSearch configuration: fields `title` +
  `body`, stored fields `id` + `title` + `createdAt` + `tags`, prefix search,
  fuzzy tolerance, title boost 2x, 150ms debounce
- [research.md §2 "Spotlight API"](./research.md) — compound component pattern
  with `Spotlight.Root`, `Spotlight.Search`, `Spotlight.ActionsList` for dynamic
  results; `spotlight.open()` / `spotlight.close()` for programmatic control;
  default `mod + K` shortcut
- [data-model.md "In-Memory Search Index"](./data-model.md) — indexed fields,
  stored fields, search options

**Integration points**:
- **Vault unlock → index build**: After `vault.unlock()` succeeds, immediately
  load all published entries and call `searchService.buildIndex(entries)`.
- **Vault lock → index clear**: `vault.lock()` must call
  `searchService.clearIndex()` to wipe decrypted data from memory.
- **Entry CRUD → incremental index update**: Each create/update/delete on the
  entry service must also update the search index.

**Verification**:
- Cmd+K opens Spotlight overlay
- Typing shows results after debounce, ranked by relevance
- Selecting result navigates to `/entry/:id`
- Empty query shows no results (or recent entries)
- No-match shows "No entries found" empty state
- After vault lock + re-unlock, search still works (index rebuilt)
- Unit tests: build index with 3 entries, search by title, search by body
  content, fuzzy match works
- `pnpm typecheck && pnpm test` passes

---

### Phase 12: Auto-Lock

**Depends on**: Phase 4 (vault lock), Phase 9 (draft save), Phase 11 (search
index clear)

**Goal**: Vault auto-locks after 5 minutes of inactivity or immediately on
visibility loss. Before locking, any unsaved editor content is drafted.

**Files to create**:
- `src/services/autoLock.ts` — implements `AutoLockService` interface
- `src/hooks/useAutoLock.ts` — React hook that starts/stops monitoring

**Files to modify**:
- `src/routes/__root.tsx` — wire `useAutoLock` into root layout with `onLock`
  callback

**References**:
- [contracts/service-interfaces.ts `AutoLockService`](./contracts/service-interfaces.ts)
  — `start()`, `resetTimer()`, `stop()` (lines 249–265)
- [spec.md FR-004](./spec.md) — 5-minute inactivity timeout
- [spec.md FR-005](./spec.md) — immediate lock on visibility loss
- [spec.md US1 scenarios 11, 12, 13](./spec.md)
- [data-model.md `settings` table](./data-model.md) — `inactivityTimeoutMs`
  (default 300000)

**Integration points — the lock cascade**:
The `onLock` callback wired in `__root.tsx` must execute these steps in order:
1. If editor is open with unsaved changes → `entryService.saveDraft()`
2. `searchService.clearIndex()` — wipe decrypted search data
3. `vaultService.lock()` — null out CryptoKey
4. Navigate to `/unlock`

**Implementation notes**:
- Inactivity timer resets on `mousemove`, `keydown`, `touchstart`, `scroll`
  events. Use a single `resetTimer()` handler attached once.
- Visibility loss detected via `document.addEventListener('visibilitychange',
  ...)` — lock when `document.hidden === true`.
- `stop()` must remove all event listeners and clear timers (called on vault
  lock to prevent re-locking while already locked, and on component unmount).

**Verification**:
- Idle for 5 minutes → vault locks, unlock screen shown
- Switch browser tab → vault locks immediately
- Minimize window → vault locks immediately
- Unsaved editor content is drafted before lock (verify by unlocking and
  checking for draft)
- Timer resets on user activity
- `pnpm typecheck && pnpm test` passes

---

### Phase 13: Keyboard Shortcuts

**Depends on**: Phase 8 (editor for Cmd+Enter), Phase 11 (search for Cmd+K)

**Goal**: All global keyboard shortcuts functional, including when CodeMirror
editor is focused.

**Files to create**:
- `src/services/keyboard.ts` — implements `KeyboardService` interface
- `src/hooks/useKeyboard.ts` — React hook for registering/unregistering
  shortcuts

**Files to modify**:
- `src/routes/__root.tsx` — register global shortcuts via `useKeyboard`
- `src/components/editor/MarkdownEditor.tsx` — ensure CodeMirror pass-through
  extension is included for Cmd+K and Cmd+N

**References**:
- [contracts/service-interfaces.ts `KeyboardService`](./contracts/service-interfaces.ts)
  — `register()` returns unsubscribe function, `unregisterAll()` (lines 234–245)
- [research.md §5 "Keyboard shortcut coexistence"](./research.md) —
  `EditorView.domEventHandlers` code example for passing Cmd+K, Cmd+N through
  to app-level handlers
- [spec.md FR-012](./spec.md) — Cmd/Ctrl+N (new entry), Cmd/Ctrl+Enter (save),
  Cmd/Ctrl+K (search palette), Esc (dismiss overlays)
- [spec.md US4 all scenarios](./spec.md)

**Implementation notes**:
- `"mod"` should map to `metaKey` on macOS and `ctrlKey` on Windows/Linux.
  Detect via `navigator.platform` or `navigator.userAgentData`.
- `register()` should add a `keydown` listener on `document` and return an
  unsubscribe function that removes it.
- `unregisterAll()` clears all registered shortcuts (called on vault lock so
  shortcuts don't work while locked).
- Cmd+Enter in the editor is context-specific (save current entry), not a
  global shortcut — handle it within the editor component, not in the global
  keyboard service.

**Verification**:
- Cmd+N from timeline → opens new entry editor
- Cmd+K from any screen → opens search palette
- Cmd+Enter from editor → saves entry
- Esc from search palette → closes it
- Cmd+K works while CodeMirror editor is focused
- Cmd+N works while CodeMirror editor is focused
- Shortcuts do not work while vault is locked (only unlock screen active)
- `pnpm typecheck && pnpm test` passes

---

### Phase 14: PWA + Error Handling + Polish

**Depends on**: All feature phases (0–13) complete

**Goal**: App is installable as a PWA, works offline, handles errors gracefully,
and passes Lighthouse PWA audit.

**Files to create**:
- `src/components/common/ReloadPrompt.tsx` — SW update prompt using
  `useRegisterSW`
- `src/components/common/StorageWarning.tsx` — storage quota warning
- `src/components/common/MultiTabWarning.tsx` — stale-tab warning
- `public/icons/` — PWA icons (192x192, 512x512, maskable)

**Files to modify**:
- `src/routes/__root.tsx` — add `ReloadPrompt`, `StorageWarning`,
  `MultiTabWarning`, strengthen error boundary
- `vite.config.ts` — finalize PWA manifest (icons, start_url, etc.)

**References**:
- [research.md §7 "Service worker registration"](./research.md) —
  `useRegisterSW` hook from `virtual:pwa-register/react`, `offlineReady` /
  `needRefresh` / `updateServiceWorker` API
- [research.md §7 "TypeScript setup"](./research.md) — add
  `"vite-plugin-pwa/react"` to `tsconfig.json` types
- [research.md §7 "Caching strategy"](./research.md) — `registerType: 'prompt'`
  to avoid data loss on auto-update
- [spec.md FR-013](./spec.md) — installable as PWA
- [spec.md FR-014](./spec.md) — identical offline/online function
- [spec.md FR-016](./spec.md) — storage quota warning
- [spec.md SC-006](./spec.md) — Lighthouse PWA audit pass
- [spec.md edge case: multi-tab](./spec.md) — warning about stale data across
  tabs

**Implementation notes**:
- Storage quota: use `navigator.storage.estimate()` to check usage vs. quota.
  Show warning when usage exceeds 80% of quota.
- Multi-tab detection: use `BroadcastChannel` or `localStorage` event to detect
  other tabs. Show a non-blocking banner warning, not a blocker.
- Error boundaries: root-level catches unhandled React errors. Subsystem-level
  boundaries around the editor (CodeMirror can fail on certain browsers) and
  the search palette. Fallback UI should offer "reload" action.

**Verification**:
- `pnpm build && pnpm preview` → app serves from service worker
- Chrome DevTools → Application → Service Workers → registered
- Chrome DevTools → Application → Manifest → installable
- Toggle offline in DevTools → app still works fully
- Lighthouse PWA audit → passes all criteria
- Trigger storage quota warning (mock or fill storage) → warning displayed
- Open in two tabs → second tab shows stale-data warning
- Trigger error boundary (e.g., corrupt entry) → fallback UI, no white screen
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes (full gate)

---

### Phase 15: E2E Tests

**Depends on**: Phase 14 (all features and polish complete)

**Goal**: Playwright tests covering all user stories and success criteria.

**Files to create**:
- `tests/e2e/setup-unlock.spec.ts` — vault setup and unlock flows
- `tests/e2e/entry-crud.spec.ts` — create, view, edit, delete entries
- `tests/e2e/editor.spec.ts` — Markdown editing and preview toggle
- `tests/e2e/search.spec.ts` — search palette with results navigation
- `tests/e2e/tags.spec.ts` — tag creation, display, and filtering
- `tests/e2e/keyboard.spec.ts` — all keyboard shortcuts
- `tests/e2e/auto-lock.spec.ts` — inactivity and visibility lock
- `tests/e2e/drafts.spec.ts` — draft save and restore
- `tests/e2e/offline.spec.ts` — offline functionality
- `tests/e2e/pwa.spec.ts` — installability, service worker

**References**:
- [spec.md all acceptance scenarios](./spec.md) — each scenario maps to one
  or more E2E test cases
- [spec.md "Success Criteria"](./spec.md) — SC-001 through SC-008, each must
  have a corresponding test
- [research.md §6](./research.md) — Vitest for unit/integration, Playwright
  for E2E including PWA/service worker scenarios

**Verification**:
- `pnpm test:e2e` passes all tests
- All success criteria (SC-001 through SC-008) verified
- Full quality gate passes: `pnpm typecheck && pnpm lint && pnpm test &&
  pnpm build && pnpm test:e2e`

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-core/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 technology decisions
├── data-model.md        # Dexie schema + encryption architecture
├── quickstart.md        # Developer setup guide
├── contracts/
│   └── service-interfaces.ts  # TypeScript service contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
vite.config.ts               # Vite config: tanstackStart, viteReact, VitePWA
postcss.config.cjs           # PostCSS: postcss-preset-mantine, simple-vars

src/
├── router.tsx               # TanStack Router instance configuration
├── routeTree.gen.ts         # Auto-generated route tree (do not edit)
├── components/
│   ├── editor/          # CodeMirror + Markdown preview toggle
│   ├── timeline/        # Entry list, entry card
│   ├── search/          # Search palette (Mantine Spotlight)
│   ├── vault/           # Setup wizard, unlock screen
│   ├── tags/            # Tag badges, filter bar
│   └── common/          # ErrorBoundary, AppShell layout
├── db/
│   ├── schema.ts        # Dexie database definition
│   ├── encryption.ts    # DBCore middleware for field encryption
│   └── index.ts         # Database instance export
├── hooks/
│   ├── useVault.ts      # Vault state + unlock/lock
│   ├── useEntries.ts    # Entry CRUD operations
│   ├── useSearch.ts     # Search index + querying
│   ├── useTags.ts       # Tag extraction + filtering
│   ├── useAutoLock.ts   # Inactivity + visibility auto-lock
│   └── useKeyboard.ts   # Global shortcut registration
├── routes/
│   ├── __root.tsx       # Root layout (AppShell, error boundary)
│   ├── index.tsx        # Redirect based on vault state
│   ├── setup.tsx        # First-time passphrase creation
│   ├── unlock.tsx       # Passphrase entry
│   ├── timeline.tsx     # Main entry list + tag filter
│   └── entry/
│       ├── new.tsx      # New entry (editor)
│       ├── $id.tsx      # View entry (rendered Markdown)
│       └── $id.edit.tsx # Edit entry (editor)
├── services/
│   ├── crypto.ts        # Web Crypto API: PBKDF2 + AES-GCM
│   ├── vault.ts         # Vault setup, unlock, lock, verify
│   ├── entries.ts       # Entry CRUD with encryption
│   ├── search.ts        # MiniSearch wrapper
│   ├── tags.ts          # Tag parsing + normalization
│   ├── autoLock.ts      # Timer + visibilitychange listener
│   └── keyboard.ts      # Shortcut registration/cleanup
├── theme/
│   └── index.ts         # Mantine theme: dark, monospace fonts
├── types/
│   └── index.ts         # Entry, VaultMeta, Setting interfaces
└── utils/
    └── date.ts          # ISO date helpers, human-readable formats

public/
└── icons/               # PWA icons (multiple sizes)

tests/
├── unit/                # crypto, tags, search, date utils
├── integration/         # Dexie + encryption, entry service
└── e2e/                 # Playwright: full user journeys
```

**Structure Decision**: Single-project SPA. No backend directory — this is a
fully client-side PWA. All source lives under `src/`. The `routes/` directory
uses TanStack Start file-based routing conventions.

## Complexity Tracking

No constitution violations detected. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | —          | —                                   |
