# Feature Specification: Reflog MVP Core

**Feature Branch**: `001-mvp-core`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "Offline-first, locally encrypted PWA developer journal with Markdown editor, full-text search, tagging, keyboard-first navigation, and PWA installability."

## Clarifications

### Session 2026-02-19

- Q: What happens when the user leaves the app idle or switches away — does the vault stay unlocked? → A: Auto-lock on both inactivity timeout (5 minutes) AND visibility loss (tab switch, minimize, screen lock).
- Q: What happens when the user navigates away from the editor with unsaved changes? → A: Auto-save draft on navigate-away (including auto-lock); explicit save still required to publish the entry to the timeline.
- Q: What layout should the Markdown editor use (split-pane, toggle, or inline live-rendering)? → A: Toggle mode — user switches between raw Markdown editor and rendered preview views. Same behavior on desktop and mobile.
- Q: Should the system enforce passphrase complexity rules? → A: Minimum 8 characters, no complexity rules (no required uppercase, symbols, or digits).

### Session 2026-02-19 (2)

- Q: Can the user change their passphrase after initial setup (when they know the current one)? → A: Out of scope for MVP; documented as planned future feature.
- Q: How should the app handle concurrent access from multiple browser tabs? → A: Allow multiple tabs; show a warning that changes in one tab may not reflect in another until reload.

### Session 2026-02-19 (3)

- Q: When filtering by multiple tags, should entries match ALL selected tags (AND) or ANY (OR)? → A: AND — entry must have all selected tags to appear.
- Q: Should editing an entry change its position in the timeline (sort by createdAt vs updatedAt)? → A: Sort by creation date (edits don't change position); show an "edited" badge with the last-modified timestamp on entries that have been modified.
- Q: When user clicks "new entry" while an unsaved draft exists, what happens? → A: Prompt the user: "You have an unsaved draft. Resume it or start fresh?" Choosing "start fresh" discards the draft.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write and Securely Save a Journal Entry (Priority: P1)

A developer opens Reflog for the first time, creates a passphrase to secure
their journal, and writes their first entry using Markdown. The entry is
encrypted and persisted locally. On subsequent visits, the developer unlocks
the app with their passphrase and sees their existing entries in a
reverse-chronological timeline. They can create new entries, edit existing
ones, and delete entries they no longer want.

**Why this priority**: This is the foundational value proposition — a private,
encrypted place to write. Without write, persist, and read-back, no other
feature has meaning. This story alone delivers a usable product.

**Independent Test**: Can be fully tested by opening the app, setting a
passphrase, writing a Markdown entry with a code block, saving it, closing
the app, reopening, unlocking with the passphrase, and confirming the entry
is displayed with correct Markdown rendering.

**Acceptance Scenarios**:

1. **Given** a first-time user, **When** they open the app, **Then** they are
   prompted to create a passphrase (minimum 8 characters) before accessing
   the journal.
2. **Given** a user with an established passphrase, **When** they open the
   app, **Then** they see an unlock screen requiring their passphrase.
3. **Given** an unlocked journal, **When** the user presses the "new entry"
   action, **Then** a blank Markdown editor opens with the current date/time
   pre-filled as the entry title.
4. **Given** an open editor in write mode, **When** the user types Markdown
   (headings, lists, code blocks, inline code, blockquotes), **Then** raw
   Markdown is displayed in a monospaced editor.
5. **Given** an open editor, **When** the user toggles to preview mode,
   **Then** the Markdown content is rendered with syntax highlighting for
   code blocks, and the user can toggle back to write mode.
6. **Given** a composed entry, **When** the user saves it, **Then** the entry
   is encrypted and stored locally, and the user is returned to the timeline
   showing the new entry at the top.
7. **Given** an existing entry in the timeline, **When** the user selects it,
   **Then** the full entry content is displayed with rendered Markdown.
8. **Given** a displayed entry, **When** the user chooses to edit, **Then**
   the Markdown editor opens with the existing content for modification.
   After saving, the entry remains at its original chronological position
   in the timeline and displays an "edited" badge with the updated timestamp.
9. **Given** a displayed entry, **When** the user chooses to delete and
   confirms the action, **Then** the entry is permanently removed from local
   storage.
10. **Given** an incorrect passphrase, **When** the user attempts to unlock,
    **Then** the app displays an error and does not reveal any entry data.
11. **Given** an unlocked vault with no user interaction for 5 minutes,
    **When** the inactivity timeout expires, **Then** the vault auto-locks
    and the unlock screen is displayed.
12. **Given** an unlocked vault, **When** the app loses visibility (tab
    switch, minimize, or screen lock), **Then** the vault auto-locks
    immediately and requires passphrase re-entry on return.
13. **Given** an editor with unsaved content, **When** the user navigates
    away, auto-lock triggers, or the tab closes, **Then** the current
    content is auto-saved as a draft (encrypted, not published to the
    timeline).
14. **Given** a previously saved draft exists, **When** the user initiates a
    new entry (Cmd+N or button), **Then** the app prompts: "You have an
    unsaved draft. Resume it or start fresh?" Choosing "Resume" restores
    the draft; choosing "Start fresh" discards the draft and opens a blank
    editor.
15. **Given** a draft entry, **When** the user explicitly saves it, **Then**
    the entry is published to the timeline and the draft state is cleared.

---

### User Story 2 - Search Past Entries (Priority: P2)

A developer has accumulated dozens of journal entries over weeks. They
remember documenting a specific Docker command but cannot recall when. They
open the search palette, type a partial query, and see matching entries
update dynamically as they type. They select a result and jump directly to
that entry.

**Why this priority**: A journal's long-term value depends on retrieval. Once
a user has enough entries that scrolling the timeline is impractical, search
becomes the primary way they extract value from past writing.

**Independent Test**: Can be tested by creating 5+ entries with distinct
content, opening the search palette, typing a keyword that appears in only
one entry, and verifying that entry appears in results.

**Acceptance Scenarios**:

1. **Given** an unlocked journal with multiple entries, **When** the user
   opens the search palette, **Then** a text input is focused and ready for
   typing.
2. **Given** an open search palette, **When** the user types a query, **Then**
   matching entries are displayed dynamically as results update with each
   keystroke (or after a brief debounce).
3. **Given** search results are displayed, **When** the user selects a
   result, **Then** they are navigated to the full entry view.
4. **Given** a query that matches no entries, **When** the user types it,
   **Then** an empty state message is shown (e.g., "No entries found").
5. **Given** an entry containing a code block with a keyword, **When** the
   user searches for that keyword, **Then** the entry appears in results
   (search covers all content including code blocks).

---

### User Story 3 - Organize Entries with Tags (Priority: P3)

A developer wants to categorize their entries by topic. While writing an
entry about a frustrating debugging session, they add the tags `#bug-hunt`
and `#rant` either inline in the text or via a dedicated tag input. Later,
they filter the timeline to show only entries tagged `#architecture` to
review their past design decisions.

**Why this priority**: Tags transform the journal from a flat stream into a
structured knowledge base. However, the app is fully usable without tags
(via search and chronological browsing), so this is a P3 enhancement.

**Independent Test**: Can be tested by creating entries with different tags,
then filtering the timeline by a specific tag and verifying only matching
entries appear.

**Acceptance Scenarios**:

1. **Given** an open editor, **When** the user types `#tag-name` inline in
   the entry body, **Then** the tag is recognized and associated with the
   entry upon save.
2. **Given** an open editor, **When** the user adds a tag via the dedicated
   tag input field, **Then** the tag is associated with the entry upon save.
3. **Given** a timeline with tagged entries, **When** the user selects one or
   more tag filters, **Then** only entries with ALL selected tags are displayed
   (AND logic).
4. **Given** a filtered timeline, **When** the user clears the filter,
   **Then** all entries are shown again in reverse-chronological order.
5. **Given** an existing entry, **When** the user edits it to add or remove
   tags, **Then** the tag associations are updated accordingly.
6. **Given** multiple entries with various tags, **When** the user views
   available tags, **Then** they see a list of all tags currently in use
   across their entries.

---

### User Story 4 - Navigate Entirely by Keyboard (Priority: P4)

A developer wants to capture a quick thought without reaching for the mouse.
They press `Cmd/Ctrl + N` to create a new entry, type their thought in
Markdown, press `Cmd/Ctrl + Enter` to save, then press `Cmd/Ctrl + K` to
open search and find something from last week. Every core action is
accessible via keyboard shortcut.

**Why this priority**: Keyboard-first navigation is a quality-of-life
feature that eliminates friction for power users. The app is functional
without it (mouse/touch still works), but shortcuts are what make it feel
like a developer tool rather than a generic notes app.

**Independent Test**: Can be tested by performing a complete workflow — new
entry, write, save, search, navigate to result — using only keyboard
shortcuts, verifying each shortcut triggers the correct action.

**Acceptance Scenarios**:

1. **Given** the app is unlocked, **When** the user presses `Cmd/Ctrl + N`,
   **Then** a new entry editor opens.
2. **Given** an open editor, **When** the user presses `Cmd/Ctrl + Enter`,
   **Then** the entry is saved.
3. **Given** any screen in the app, **When** the user presses `Cmd/Ctrl + K`,
   **Then** the search palette opens.
4. **Given** a shortcut conflicts with a browser default (e.g., `Cmd + S`),
   **Then** the app's shortcut takes precedence when the app is focused.
5. **Given** any modal or overlay is open, **When** the user presses `Esc`,
   **Then** the modal or overlay is dismissed.

---

### User Story 5 - Install and Use Offline (Priority: P5)

A developer installs Reflog as a standalone app on their laptop and phone.
Later, while on a flight without internet, they open the app, unlock it,
write a new entry, search past entries, and tag content — all without any
degradation in functionality compared to online use.

**Why this priority**: Offline capability and installability are
infrastructure concerns that underpin the entire app. However, from a
pure user-story perspective, a developer can get immediate value from the
app in a browser tab (stories 1-4) before installation matters. Offline
resilience is the final layer that fulfills the "always available" promise.

**Independent Test**: Can be tested by installing the app, going fully
offline (airplane mode), and performing all core actions (unlock, write,
save, search, tag) with identical behavior to online mode.

**Acceptance Scenarios**:

1. **Given** a user visits the app in a supported browser, **When** they
   choose to install, **Then** the app installs as a standalone application
   on their device.
2. **Given** the app is installed, **When** the user opens it without
   internet connectivity, **Then** the app loads fully and displays the
   unlock screen.
3. **Given** the app is offline and unlocked, **When** the user creates,
   edits, deletes, searches, or tags entries, **Then** all operations
   complete successfully with no errors or degradation.
4. **Given** the app was used offline, **When** the device reconnects to the
   internet, **Then** the app continues functioning identically (no sync
   needed since all data is local).

---

### Edge Cases

- What happens when the user forgets their passphrase? Data is
  irrecoverable by design (documented during onboarding).
- What happens when the device's local storage quota is exhausted? The app
  displays a clear warning and prevents new entries until space is freed.
- What happens when the user enters an extremely long entry (e.g., 100,000+
  characters)? The editor remains responsive and the entry saves without
  truncation.
- What happens when the user has hundreds of tags? The tag list remains
  navigable with scrolling or search within tags.
- What happens when search results span thousands of entries? Results are
  paginated or virtualized so the interface remains responsive.
- What happens when the user opens the app in two browser tabs simultaneously?
  Multiple tabs are allowed. The app displays a warning that changes made in
  one tab may not be reflected in another until the page is reloaded. IndexedDB
  transactions prevent data corruption at the storage layer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Markdown editor with a toggle between
  raw write mode and rendered preview mode, supporting headings, lists,
  code blocks (with multi-language syntax highlighting), inline code,
  blockquotes, bold, and italic formatting.
- **FR-002**: System MUST encrypt all journal entries, tags, and user
  settings at rest using a user-defined passphrase established on first
  launch. The passphrase MUST be at least 8 characters; no additional
  complexity rules are enforced.
- **FR-003**: System MUST require passphrase entry to unlock and decrypt
  data on each app launch (no auto-unlock without explicit user action).
- **FR-004**: System MUST auto-lock the vault after 5 minutes of user
  inactivity, clearing decrypted data from memory and displaying the
  unlock screen.
- **FR-005**: System MUST auto-lock the vault immediately when the app
  loses visibility (tab switch, window minimize, or device screen lock).
- **FR-006**: System MUST store all data exclusively on the user's device
  with zero network transmission of user content.
- **FR-007**: System MUST display entries in a reverse-chronological
  timeline sorted by creation date (editing an entry does not change its
  position). Entries that have been modified MUST display an "edited" badge
  with the last-modified timestamp.
- **FR-008**: System MUST support creating, reading, editing, and deleting
  journal entries (full CRUD).
- **FR-009**: System MUST provide full-text search across all entry content
  (including code blocks) with results updating dynamically as the user
  types.
- **FR-010**: System MUST support tagging entries via inline `#tag-name`
  syntax in the entry body and via a dedicated tag input field.
- **FR-011**: System MUST allow filtering the timeline by one or more tags
  using AND logic (entry must have ALL selected tags to appear in results).
- **FR-012**: System MUST support the following global keyboard shortcuts:
  `Cmd/Ctrl + N` (new entry), `Cmd/Ctrl + Enter` (save entry),
  `Cmd/Ctrl + K` (open search palette), and `Esc` (dismiss overlays).
- **FR-013**: System MUST be installable as a PWA on desktop and mobile
  operating systems.
- **FR-014**: System MUST function identically offline and online — all
  features available without network connectivity.
- **FR-015**: System MUST warn the user during initial setup that passphrase
  loss results in permanent data loss (no recovery mechanism).
- **FR-016**: System MUST display a clear error when storage quota is
  approaching or exceeded.
- **FR-017**: System MUST auto-populate new entries with the current
  date and time as a default title.
- **FR-018**: System MUST auto-save editor content as an encrypted draft
  when the user navigates away, the vault auto-locks, or the app closes.
  Drafts MUST NOT appear in the timeline until explicitly saved.
- **FR-019**: When the user initiates a new entry and a draft exists, the
  system MUST prompt the user to resume the draft or start fresh. Choosing
  "Resume" restores the draft content; choosing "Start fresh" discards the
  draft and opens a blank editor.

### Key Entities

- **Entry**: A single journal item. Attributes: unique identifier, title
  (defaults to date/time), Markdown body content, creation timestamp, last
  modified timestamp, associated tags, status (draft or published). Draft
  entries are not visible in the timeline.
- **Tag**: A label for categorizing entries. Attributes: name (lowercase,
  hyphenated, e.g., `bug-hunt`), associated entry count. Tags are derived
  from entry content and explicit tag input — they do not exist
  independently of entries.
- **Vault**: The encrypted container for all user data. Attributes:
  PBKDF2 salt, encrypted passphrase verification blob (sentinel string
  encrypted with the derived key), IV, creation date. A single vault
  exists per device.

### Assumptions

- Passphrase recovery is intentionally unsupported. Forgetting the
  passphrase means permanent data loss — this is a feature, not a bug,
  and aligns with the zero-trust privacy model.
- Data retention is indefinite — entries persist until the user explicitly
  deletes them or clears local storage.
- Tag names follow a `lowercase-hyphenated` convention, automatically
  normalized from user input (e.g., "Bug Hunt" becomes `bug-hunt`).
- The app is single-user, single-device. No multi-user or multi-device
  sync is expected.
- The Markdown editor does not need WYSIWYG toolbar buttons — developers
  write raw Markdown. A preview/render pane is sufficient.

### Out of Scope

- Cloud syncing or multi-device synchronization
- Image or file attachments
- Collaboration or sharing features
- Complex analytics or data visualization (e.g., mood tracking graphs)
- Export/import functionality
- Passphrase recovery or reset mechanisms
- Passphrase change (planned for future release; requires re-encryption of
  all data with new key)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from opening the app to saving their first
  journal entry in under 60 seconds (including passphrase setup).
- **SC-002**: Users can create a new entry and save it in under 5 seconds
  on subsequent uses (unlock + new + save).
- **SC-003**: Search returns matching results within 1 second for a journal
  containing up to 1,000 entries.
- **SC-004**: The app loads and is interactive within 3 seconds on a
  standard mobile device, both online and offline.
- **SC-005**: All core workflows (create, edit, delete, search, tag, filter)
  are completable using only keyboard shortcuts.
- **SC-006**: The app passes Lighthouse PWA audit criteria for
  installability and offline capability.
- **SC-007**: 100% of user data remains on-device — zero network requests
  transmitting user content are observed during any workflow.
- **SC-008**: The app gracefully handles storage quota exhaustion by
  displaying a user-facing warning before data loss can occur.
