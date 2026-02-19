# Tasks: Reflog MVP Core

**Input**: Design documents from `/specs/001-mvp-core/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/service-interfaces.ts, quickstart.md

**Tests**: Included — the implementation plan specifies unit, integration, and E2E test files. The project constitution requires tests to pass before commit.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — working dev server with Mantine dark theme on an empty page

- [x] T001 Initialize package.json with all dependencies from research.md Version Matrix and configure yarn workspace
- [x] T002 [P] Configure vite.config.ts with TanStack Start SPA plugin, Vite React plugin, and VitePWA plugin per research.md §1
- [x] T003 [P] Configure tsconfig.json (strict mode, no `any`, path aliases, `"vite-plugin-pwa/react"` in types) and postcss.config.cjs (postcss-preset-mantine, postcss-simple-vars) per research.md §2
- [x] T004 [P] Configure ESLint and Prettier for TypeScript strict project in eslint.config.js and .prettierrc
- [x] T005 [P] Configure vitest.config.ts and playwright.config.ts per research.md §6

**Checkpoint**: `pnpm dev` starts on http://localhost:3000, `pnpm typecheck` passes, `pnpm lint` passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type system, crypto, encrypted database, vault service, and app shell — all must be complete before any user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Types & Utilities

- [x] T006 Create all entity types (Entry, VaultMeta, Setting) and service input/result types (CreateEntryInput, UpdateEntryInput, SearchResult, TagWithCount, KeyboardShortcut) in src/types/index.ts per contracts/service-interfaces.ts
- [x] T007 [P] Create ISO date helpers and human-readable default title formatter in src/utils/date.ts

### Crypto Service

- [x] T008 Implement CryptoUtils (deriveKey, generateSalt, encrypt, decrypt) using Web Crypto API with PBKDF2 + AES-256-GCM in src/services/crypto.ts per data-model.md Key Derivation and Field Encryption
- [x] T009 Write crypto unit tests (derive key, encrypt/decrypt roundtrip, wrong key fails) in tests/unit/crypto.test.ts

### Database + Encryption Middleware

- [x] T010 [P] Create Dexie database schema with vault_meta, entries (compound index [status+createdAt]), and settings tables in src/db/schema.ts per data-model.md Tables, using EntityTable<T> typing per research.md §3
- [x] T011 Implement DBCore encryption middleware intercepting mutate/get/getMany/query for entries and settings tables in src/db/encryption.ts per research.md §3 middleware pattern
- [x] T012 Create database instance export applying encryption middleware in src/db/index.ts
- [x] T013 Write DB encryption integration tests (write entry → verify ciphertext in raw IndexedDB → read via Dexie → verify plaintext; vault_meta unencrypted) in tests/integration/db-encryption.test.ts

### Vault Service

- [x] T014 Implement VaultService (isSetUp, setup, unlock, lock, isUnlocked) managing in-memory CryptoKey reference in src/services/vault.ts per data-model.md Vault Lifecycle and Passphrase Verification
- [x] T015 Create useVault React hook with context provider exposing vault state and actions in src/hooks/useVault.ts
- [x] T016 Write vault service unit tests (setup creates vault_meta, correct passphrase unlocks, wrong passphrase throws, lock nulls key, isSetUp checks) in tests/unit/vault.test.ts

### App Shell + Vault UI

- [x] T017 [P] Create Mantine dark theme configuration with monospace font overrides (Fira Code, JetBrains Mono) and defaultColorScheme: 'dark' in src/theme/index.ts per research.md §2
- [x] T018 [P] Create ErrorBoundary component with fallback UI and reload action in src/components/common/ErrorBoundary.tsx
- [x] T019 Create TanStack Router instance in src/router.tsx and root layout with MantineProvider, AppShell, Mantine style imports, and ErrorBoundary wrapper in src/routes/__root.tsx per research.md §1, §2
- [x] T020 Implement SetupWizard component (passphrase input with 8-char minimum validation + data loss warning) in src/components/vault/SetupWizard.tsx and setup route in src/routes/setup.tsx per spec.md FR-002, FR-015
- [x] T021 [P] Implement UnlockScreen component (passphrase entry with error display) in src/components/vault/UnlockScreen.tsx and unlock route in src/routes/unlock.tsx per spec.md FR-003
- [x] T022 Implement index redirect route (no vault → /setup, locked → /unlock, unlocked → /timeline) in src/routes/index.tsx

**Checkpoint**: First visit → setup screen → create passphrase → redirected to empty timeline placeholder → close/reopen → unlock screen → wrong passphrase → error. `pnpm typecheck && pnpm test && pnpm build` passes.

---

## Phase 3: User Story 1 — Write and Securely Save a Journal Entry (Priority: P1) 🎯 MVP

**Goal**: Developer can create, view, edit, and delete encrypted Markdown journal entries with auto-save drafts and auto-lock security.

**Independent Test**: Open app → set passphrase → write Markdown entry with code block → save → close → reopen → unlock → entry displayed with correct Markdown rendering → edit → "edited" badge shown → delete → entry removed.

### Entry CRUD Service

- [x] T023 [US1] Implement EntryService (create, getById, list, update, delete) with UUID generation and compound index queries in src/services/entries.ts per contracts/service-interfaces.ts EntryService and data-model.md Entry Lifecycle
- [x] T024 [US1] Create useEntries React hook wrapping useLiveQuery for reactive entry lists in src/hooks/useEntries.ts per research.md §3 React integration
- [x] T025 [US1] Write entry service unit tests in tests/unit/entries.test.ts
- [x] T026 [US1] Write entry CRUD integration tests (create → list → update → delete cycle, default title generation, draft exclusion from list) in tests/integration/entry-crud.test.ts

### Timeline View

- [x] T027 [US1] Create EmptyState component ("No entries yet" with call-to-action) in src/components/timeline/EmptyState.tsx
- [x] T028 [P] [US1] Create EntryCard component (title, date, tag badges, "edited" badge with updatedAt when createdAt !== updatedAt, preview snippet) in src/components/timeline/EntryCard.tsx per spec.md FR-007
- [x] T029 [US1] Create EntryList component rendering entry cards in reverse-chronological order by createdAt in src/components/timeline/EntryList.tsx
- [x] T030 [US1] Implement timeline route composing EntryList + EmptyState with useEntries hook in src/routes/timeline.tsx per spec.md FR-007

### Markdown Editor + Entry Views

- [x] T031 [US1] Create MarkdownEditor component using @uiw/react-codemirror with markdown() extension and oneDark theme in src/components/editor/MarkdownEditor.tsx per research.md §5
- [x] T032 [P] [US1] Create MarkdownPreview component using react-markdown with remarkGfm and rehypeHighlight in src/components/editor/MarkdownPreview.tsx per research.md §5
- [x] T033 [US1] Create EditorTabs component with Mantine Tabs for Write/Preview toggle (preserving editor state across toggles) in src/components/editor/EditorTabs.tsx per research.md §2
- [x] T034 [US1] Implement new entry route with editor, auto-populated date title, and save action in src/routes/entry/new.tsx per spec.md FR-017
- [x] T035 [P] [US1] Implement view entry route with rendered Markdown and edit/delete actions in src/routes/entry/$id.tsx
- [x] T036 [P] [US1] Implement edit entry route with editor pre-filled from existing entry in src/routes/entry/$id.edit.tsx

### Draft Auto-Save

- [x] T037 [US1] Add saveDraft, getDraft, publishDraft, discardDraft methods to src/services/entries.ts and expose via src/hooks/useEntries.ts per contracts/service-interfaces.ts draft methods and data-model.md Draft state
- [x] T038 [US1] Wire auto-save on unmount/route-change in editor components and add draft-exists prompt ("Resume or Start fresh?") to src/routes/entry/new.tsx per spec.md FR-018, FR-019. Note: `beforeunload` is unreliable for async IndexedDB writes — use it as best-effort; primary draft safety comes from route-change and auto-lock triggers

### Auto-Lock

- [x] T039 [US1] Implement AutoLockService (start, resetTimer, stop) with 5-min inactivity timer and visibilitychange listener in src/services/autoLock.ts per contracts/service-interfaces.ts AutoLockService and spec.md FR-004, FR-005
- [x] T040 [US1] Create useAutoLock React hook in src/hooks/useAutoLock.ts and wire into src/routes/__root.tsx with lock cascade (save draft → lock vault → navigate to /unlock)

**Checkpoint**: Full CRUD cycle works — create entry with Markdown → renders in timeline → view with rendered Markdown → edit → "edited" badge appears → delete with confirmation → removed. Drafts auto-save on navigate-away. Auto-lock after 5 min idle or tab switch. `pnpm typecheck && pnpm test` passes.

---

## Phase 4: User Story 2 — Search Past Entries (Priority: P2)

**Goal**: Developer can press Cmd+K, type a partial query, and see matching entries update dynamically via MiniSearch on decrypted in-memory data.

**Independent Test**: Create 5+ entries with distinct content → open search → type keyword from one entry → that entry appears in results → select it → navigate to entry view.

- [x] T041 [US2] Implement SearchService (buildIndex, search, addToIndex, updateInIndex, removeFromIndex, clearIndex) wrapping MiniSearch with title+body indexing, prefix search, fuzzy tolerance, title 2x boost in src/services/search.ts per research.md §4 and contracts/service-interfaces.ts SearchService
- [x] T042 [US2] Create useSearch React hook with debounced query (150ms) in src/hooks/useSearch.ts
- [x] T043 [US2] Create SearchPalette component using Mantine Spotlight compound components (Spotlight.Root, Spotlight.Search, Spotlight.ActionsList) with dynamic results, empty state, and a max-results cap (50) to keep the UI responsive for large result sets in src/components/search/SearchPalette.tsx per research.md §2 Spotlight API
- [x] T044 [US2] Wire SearchPalette into root layout in src/routes/__root.tsx
- [x] T045 [US2] Wire search index build into vault unlock and index clear into vault lock in src/services/vault.ts; add search index clear to auto-lock cascade in src/routes/__root.tsx
- [x] T046 [US2] Wire incremental search index updates (addToIndex, updateInIndex, removeFromIndex) into entry create/update/delete in src/services/entries.ts
- [x] T047 [US2] Write search unit tests (build index with 3 entries, search by title, search by body, fuzzy match, rebuild after lock/unlock) in tests/unit/search.test.ts

**Checkpoint**: Cmd+K opens Spotlight → type query → results appear after debounce → select result → navigate to entry → no-match shows empty state → vault lock + re-unlock → search still works (index rebuilt). `pnpm typecheck && pnpm test` passes.

---

## Phase 5: User Story 3 — Organize Entries with Tags (Priority: P3)

**Goal**: Developer can add tags via inline #syntax and dedicated input, see them as badges on entries, and filter the timeline by tags using AND logic.

**Independent Test**: Create entries with different tags → filter timeline by a tag → only matching entries shown → clear filter → all entries visible → select multiple tags → only entries with ALL selected tags shown.

- [x] T048 [US3] Implement TagService (extractFromBody, normalize, mergeTags, getAllWithCounts) with 6-step normalization rules in src/services/tags.ts per contracts/service-interfaces.ts TagService and data-model.md Tag Normalization Rules
- [x] T049 [US3] Create useTags React hook for tag state and AND-logic filtering in src/hooks/useTags.ts per spec.md FR-011
- [x] T050 [P] [US3] Create TagBadge component using Mantine Badge in src/components/tags/TagBadge.tsx per research.md §2
- [x] T051 [P] [US3] Create TagInput component (dedicated tag input field for editor) in src/components/tags/TagInput.tsx
- [x] T052 [US3] Create TagFilterBar component (scrollable tag list with counts for timeline filtering; include a text filter to narrow the tag list when hundreds of tags exist) in src/components/tags/TagFilterBar.tsx
- [x] T053 [US3] Wire TagInput into MarkdownEditor below editor in src/components/editor/MarkdownEditor.tsx and add tag extraction on save in entry routes
- [x] T054 [US3] Wire TagFilterBar into timeline route in src/routes/timeline.tsx and add tag badges to EntryCard in src/components/timeline/EntryCard.tsx
- [x] T055 [US3] Write tag service unit tests (all 6 normalization rules, extractFromBody regex, mergeTags deduplication, getAllWithCounts aggregation) in tests/unit/tags.test.ts

**Checkpoint**: Write entry with #bug-hunt in body → tag appears on card → add tag via input → also appears → filter by tag → matching only → multi-tag filter uses AND logic → clear filter → all entries. `pnpm typecheck && pnpm test` passes.

---

## Phase 6: User Story 4 — Navigate Entirely by Keyboard (Priority: P4)

**Goal**: Every core action accessible via keyboard shortcut, including when CodeMirror editor is focused.

**Independent Test**: Perform complete workflow using only keyboard — Cmd+N (new entry) → type → Cmd+Enter (save) → Cmd+K (search) → type → select → Esc (dismiss) — verifying each shortcut triggers the correct action.

- [x] T056 [US4] Implement KeyboardService (register returning unsubscribe function, unregisterAll) with mod key detection (metaKey on macOS, ctrlKey on Windows/Linux) in src/services/keyboard.ts per contracts/service-interfaces.ts KeyboardService
- [x] T057 [US4] Create useKeyboard React hook for registering/unregistering shortcuts in src/hooks/useKeyboard.ts
- [x] T058 [US4] Register global shortcuts (Cmd+N → new entry, Cmd+K → search, Esc → dismiss overlays) via useKeyboard in src/routes/__root.tsx and unregister on vault lock
- [x] T059 [US4] Add Cmd+Enter context-specific save shortcut in src/routes/entry/new.tsx and src/routes/entry/$id.edit.tsx
- [x] T060 [US4] Add EditorView.domEventHandlers extension for Cmd+K and Cmd+N pass-through in src/components/editor/MarkdownEditor.tsx per research.md §5 keyboard coexistence

**Checkpoint**: Cmd+N from timeline → editor opens → Cmd+K while editor focused → search opens → Cmd+Enter saves → Esc dismisses overlays → shortcuts disabled while locked. `pnpm typecheck && pnpm test` passes.

---

## Phase 7: User Story 5 — Install and Use Offline (Priority: P5)

**Goal**: App installable as PWA, fully functional offline, with graceful error handling and service worker update prompts.

**Independent Test**: Install app → go offline → unlock → create/edit/delete/search/tag entries → all operations succeed identically to online mode.

- [x] T061 [P] [US5] Create ReloadPrompt component using useRegisterSW hook (offlineReady, needRefresh, updateServiceWorker) in src/components/common/ReloadPrompt.tsx per research.md §7
- [x] T062 [P] [US5] Create StorageWarning component using navigator.storage.estimate() (warn at 80% quota; at 95%+ quota, disable save/create actions and show "Storage full — free space to continue" modal) in src/components/common/StorageWarning.tsx per spec.md FR-016 and edge case "prevents new entries until space is freed"
- [x] T063 [P] [US5] Create MultiTabWarning component using BroadcastChannel for stale-tab detection in src/components/common/MultiTabWarning.tsx per spec.md edge case multi-tab
- [x] T064 [US5] Create PWA icons (192x192, 512x512, maskable) in public/icons/ and finalize PWA manifest (icons, start_url, theme_color) in vite.config.ts per spec.md FR-013
- [x] T065 [US5] Wire ReloadPrompt, StorageWarning, and MultiTabWarning into root layout in src/routes/__root.tsx
- [x] T066 [US5] Strengthen error boundaries: add subsystem-level boundaries for encryption/decryption failures (fallback: "Your data is safe but cannot be decrypted right now"), IndexedDB quota exhaustion (fallback: "Storage full — free space to continue"), Service Worker lifecycle errors (fallback: "Update available — reload to continue"), and editor/search crashes in src/components/common/ErrorBoundary.tsx per constitution Principle V and wire into component tree

**Checkpoint**: `pnpm build && pnpm preview` → service worker registered → manifest installable → toggle offline → app works fully → Lighthouse PWA audit passes → storage warning triggers at 80% → second tab shows stale-data warning. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes (full gate).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end tests covering all user stories and success criteria, plus final validation

### E2E Tests

- [x] T067 [P] Write E2E tests for vault setup and unlock flows in tests/e2e/setup-unlock.spec.ts per spec.md US1 scenarios 1, 2, 10
- [x] T068 [P] Write E2E tests for entry create, view, edit, delete in tests/e2e/entry-crud.spec.ts per spec.md US1 scenarios 3, 6, 7, 8, 9
- [x] T069 [P] Write E2E tests for Markdown editing and preview toggle in tests/e2e/editor.spec.ts per spec.md US1 scenarios 4, 5
- [x] T070 [P] Write E2E tests for search palette with results navigation in tests/e2e/search.spec.ts per spec.md US2 all scenarios
- [x] T071 [P] Write E2E tests for tag creation, display, and AND-logic filtering in tests/e2e/tags.spec.ts per spec.md US3 all scenarios
- [x] T072 [P] Write E2E tests for all keyboard shortcuts including CodeMirror focus in tests/e2e/keyboard.spec.ts per spec.md US4 all scenarios
- [x] T073 [P] Write E2E tests for auto-lock (inactivity, visibility, draft preservation) in tests/e2e/auto-lock.spec.ts per spec.md US1 scenarios 11, 12, 13
- [x] T074 [P] Write E2E tests for draft save and restore with prompt in tests/e2e/drafts.spec.ts per spec.md US1 scenarios 13, 14, 15
- [x] T075 [P] Write E2E tests for offline functionality in tests/e2e/offline.spec.ts per spec.md US5 scenarios 2, 3, 4
- [x] T076 [P] Write E2E tests for PWA installability and service worker in tests/e2e/pwa.spec.ts per spec.md US5 scenario 1, SC-006

### Performance Verification

- [ ] T077 [P] Run Lighthouse performance + PWA audit on production build and verify SC-004 (<3s load) and SC-006 (PWA criteria pass)
- [x] T078 [P] Run MiniSearch benchmark: seed 1000 synthetic entries, measure index build time and query latency, verify SC-003 (<1s search) in tests/integration/search-perf.test.ts

### Final Validation

- [x] T079 Run full quality gate: yarn typecheck && yarn lint && yarn test && yarn build
- [ ] T080 Validate quickstart.md first-run verification steps manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — no dependencies on other stories
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) — integrates with vault (unlock/lock) and entries (CRUD events) from US1
- **US3 (Phase 5)**: Depends on Foundational (Phase 2) — integrates with editor and timeline from US1
- **US4 (Phase 6)**: Depends on Foundational (Phase 2) — integrates with editor (Cmd+Enter), search (Cmd+K) from US1/US2
- **US5 (Phase 7)**: Depends on all feature phases (US1–US4) — PWA polish and error handling across all features
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```text
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ◄── BLOCKS ALL STORIES
    │
    ├──► Phase 3: US1 (P1) — Write & Save ◄── MVP milestone
    │       │
    │       ├──► Phase 4: US2 (P2) — Search (integrates with entries/vault)
    │       │
    │       ├──► Phase 5: US3 (P3) — Tags (integrates with editor/timeline)
    │       │
    │       └──► Phase 6: US4 (P4) — Keyboard (integrates with editor/search)
    │
    └──► Phase 7: US5 (P5) — PWA + Offline (after US1–US4)
              │
              ▼
         Phase 8: Polish (E2E tests, final validation)
```

### Within Each User Story

- Types/utilities before services
- Services before hooks
- Hooks before UI components
- Components before route wiring
- Tests alongside or immediately after implementation
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002, T003, T004, T005 can all run in parallel after T001

**Phase 2 (Foundational)**:
- T006 (types) + T007 (date utils) in parallel
- T008 (crypto) + T010 (DB schema) in parallel after T006
- T017 (theme) + T018 (ErrorBoundary) in parallel (independent)
- T020 (setup wizard) + T021 (unlock screen) in parallel

**Phase 3 (US1)**:
- T027 (EmptyState) + T028 (EntryCard) in parallel
- T031 (editor) + T032 (preview) in parallel
- T035 (view route) + T036 (edit route) in parallel

**Phase 4–6**: US2, US3, US4 can start in parallel after US1 if team capacity allows (though US2–US4 integrate with US1 components)

**Phase 8 (Polish)**: All E2E test files (T067–T076) can be written in parallel

---

## Parallel Example: User Story 1

```bash
# After Entry CRUD service, launch timeline components in parallel:
Task: "Create EmptyState component in src/components/timeline/EmptyState.tsx"
Task: "Create EntryCard component in src/components/timeline/EntryCard.tsx"

# After timeline, launch editor components in parallel:
Task: "Create MarkdownEditor component in src/components/editor/MarkdownEditor.tsx"
Task: "Create MarkdownPreview component in src/components/editor/MarkdownPreview.tsx"

# After editor tabs, launch entry routes in parallel:
Task: "Implement view entry route in src/routes/entry/$id.tsx"
Task: "Implement edit entry route in src/routes/entry/$id.edit.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently — full CRUD, drafts, auto-lock
5. Deploy/demo if ready — this is a usable encrypted journal

### Incremental Delivery

1. Setup + Foundational → Foundation ready (vault, crypto, encrypted DB)
2. Add US1 → Test independently → **MVP!** (write, save, edit, delete, auto-lock)
3. Add US2 → Test independently → Search works (Cmd+K, MiniSearch)
4. Add US3 → Test independently → Tags work (inline + input, AND filtering)
5. Add US4 → Test independently → Full keyboard navigation
6. Add US5 → Test independently → PWA installable, offline, error handling
7. Polish → E2E tests, Lighthouse audit, quality gate

### Per-Story Verification

Each story's checkpoint is designed to be independently testable:
- **US1**: Open → setup → write → save → close → unlock → entry present → edit → "edited" badge → delete
- **US2**: Create entries → Cmd+K → type → results → select → navigate → lock/unlock → search rebuilds
- **US3**: Write with #tags → save → badge visible → filter → AND logic → clear
- **US4**: Cmd+N → type → Cmd+Enter → Cmd+K → Esc — all via keyboard only
- **US5**: Build → install → offline → all operations → Lighthouse passes

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Auto-lock cascade is implemented incrementally: draft-save + vault-lock in US1, search-clear added in US2
- The "edited" badge (FR-007 clarification) is built into EntryCard in US1
- Tag filter AND logic (FR-011 clarification) is built into useTags in US3
- Draft resume prompt (FR-019 clarification) is wired in US1 draft auto-save tasks
