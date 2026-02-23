# Feature Specification: Authentication & Cross-Device Sync

**Feature Branch**: `004-auth-and-sync`
**Created**: 2026-02-21
**Status**: Draft
**Input**: User description: "I would like to begin expanding the design of Reflog past the original MVP. As a user I want the ability to lock/logout of my current session. As a user I want to be able to access my Reflog from any device (phone, tablet, laptop, or desktop) that I own. As a developer I want to ensure user data security while keeping my hosting costs low and protect myself from DDoS or malicious account creation and API usage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — User Account & Authentication (Priority: P1)

As a user, I want to create an account and authenticate so that I can identify myself across my devices and enable data synchronization.

**Why this priority**: Authentication is the foundation for every other capability in this feature. Without accounts, there is no way to associate data across devices. It also introduces the concept of "logout" (ending an authenticated session), which is explicitly requested.

**Independent Test**: Can be fully tested by creating an account on one device, logging out, and logging back in. The account exists and authenticates correctly even without sync enabled. Delivers value by establishing identity and enabling logout.

**Acceptance Scenarios**:

1. **Given** a new user with no account, **When** they provide their email address and complete verification, **Then** an account is created and they are prompted to set up or connect their vault.
2. **Given** a user with an existing account, **When** they enter their credentials on any device, **Then** they are authenticated and can access the app.
3. **Given** a user who is authenticated, **When** they choose to log out, **Then** their session is ended and they are returned to the login screen.
4. **Given** a user entering incorrect credentials, **When** they exceed the maximum number of failed attempts, **Then** their account is temporarily locked and they are informed of the lockout duration.
5. **Given** a user who has forgotten their account password, **When** they initiate account recovery via email, **Then** they can reset their account credential and regain access (note: this does NOT recover vault data if the vault passphrase is also forgotten).
6. **Given** an existing user with a local-only vault from the MVP, **When** they open the app after the upgrade, **Then** they are required to create an account before accessing their vault. Their existing local data is preserved and synced to the server once the account is set up and the vault is unlocked.

---

### User Story 2 — Cross-Device Encrypted Sync (Priority: P2)

As a user, I want my journal entries, tags, and settings to be available on all devices I own, so that I can write and review my journal from my phone, tablet, laptop, or desktop seamlessly.

**Why this priority**: This is the primary user-facing value of the feature — multi-device access. It depends on US1 (authentication) being in place. It is the most complex story and represents the core "expansion past MVP" requested by the user.

**Independent Test**: Can be tested by logging in on two devices, creating an entry on device A, and verifying it appears on device B. Delivers value by enabling multi-device journal access with end-to-end encryption.

**Acceptance Scenarios**:

1. **Given** a user logged in on device A with an unlocked vault, **When** they create a new journal entry, **Then** the entry is synced to the server in encrypted form and becomes available on device B after the vault is unlocked there.
2. **Given** a user logged in on device B with no local data, **When** they unlock their vault for the first time on that device, **Then** all existing entries are downloaded and decrypted locally.
3. **Given** a user who creates entries on device A while offline, **When** device A reconnects to the internet, **Then** the queued changes are synced automatically without user intervention.
4. **Given** a user who edits the same entry on device A and device B while both are offline, **When** both devices reconnect, **Then** the system resolves the conflict (most recent edit wins) and the user is notified that a conflict was resolved.
5. **Given** a user who deletes an entry on device A, **When** device B syncs, **Then** the entry is removed from device B as well.
6. **Given** that the sync server stores user data, **When** inspecting the stored data, **Then** all journal content (titles, bodies, tags, settings) is encrypted and unreadable without the user's vault passphrase.

---

### User Story 3 — Enhanced Session Management (Priority: P2)

As a user, I want clear and distinct "lock" and "logout" actions so that I can quickly secure my session (lock) or fully disconnect my account from a device (logout).

**Why this priority**: The app already has a lock mechanism (auto-lock + manual lock). This story enhances it by adding a distinct logout action in the context of user accounts, and clarifying the security semantics of each action. It delivers immediate security value and is a natural extension of US1.

**Independent Test**: Can be tested by locking a session (verifying passphrase is required to resume), then logging out (verifying account disconnection and optionally clearing local data). Delivers value by giving users explicit control over their session security.

**Acceptance Scenarios**:

1. **Given** an authenticated user with an unlocked vault, **When** they lock their session, **Then** the vault passphrase is required to resume, but the user remains authenticated and local data is preserved.
2. **Given** an authenticated user (locked or unlocked), **When** they choose to log out, **Then** they are asked whether to keep or clear local data, their sync session is disconnected, and they are returned to the login screen.
3. **Given** a user who chose "clear local data" on logout, **When** they log back in on the same device, **Then** their data is re-downloaded from the sync server (requires vault passphrase to decrypt).
4. **Given** a user who chose "keep local data" on logout, **When** they return to the app, **Then** they must authenticate and unlock the vault before accessing their data.
5. **Given** an authenticated user whose session has been idle beyond the configured timeout, **When** the timeout fires, **Then** the vault is locked automatically (existing behavior preserved).

---

### User Story 4 — Abuse Protection & Cost Management (Priority: P3)

As the developer, I want the sync service to be protected against DDoS attacks, malicious account creation, and excessive API usage so that hosting costs remain low and the service stays available for legitimate users.

**Why this priority**: This is a developer/operator concern rather than a direct user feature. It can be implemented incrementally after the core auth and sync infrastructure is in place. However, it must be designed for from the start — retrofitting abuse protection is harder than building it in.

**Independent Test**: Can be tested by simulating rapid API requests and verifying rate limiting activates, attempting mass account creation and verifying throttling, and monitoring hosting costs under normal and elevated load. Delivers value by keeping the service sustainable and available.

**Acceptance Scenarios**:

1. **Given** an unauthenticated client making excessive requests, **When** the request rate exceeds the configured threshold, **Then** requests are rejected with an appropriate error and the client is temporarily blocked.
2. **Given** a malicious actor attempting to create many accounts rapidly, **When** account creation rate exceeds the configured threshold from a single source, **Then** additional registrations are blocked and require additional verification (e.g., CAPTCHA).
3. **Given** a single authenticated user making an excessive number of sync requests, **When** the per-user rate limit is exceeded, **Then** additional requests are queued or rejected gracefully without data loss.
4. **Given** normal usage patterns from up to 1,000 active users, **When** reviewing monthly hosting costs, **Then** costs remain within the budgeted threshold.
5. **Given** a user whose stored data approaches the per-account storage limit, **When** they attempt to sync more data, **Then** they are informed of the limit and given guidance on reducing usage.

---

### Edge Cases

- **Vault passphrase forgotten**: Data is unrecoverable. This is inherent to the zero-knowledge encryption model. The user must create a new vault and loses all existing entries. Account access can be recovered separately via email.
- **Account password forgotten**: Standard email-based recovery flow resets the account credential. Encrypted data remains intact since the vault passphrase is independent.
- **Device lost or stolen**: The vault auto-lock protects data at rest. The user can change their account password from another device to prevent the thief from syncing. Local encrypted data on the lost device remains protected by the vault passphrase.
- **Internet lost mid-sync**: Partial sync must be resumable. The system must not leave data in an inconsistent state. Changes not yet confirmed by the server remain queued locally.
- **Browser clears IndexedDB**: If a browser purges IndexedDB storage (e.g., storage pressure), the user can recover by logging in and re-syncing from the server. Sync acts as a backup.
- **Same entry deleted on one device, edited on another**: The edit should take precedence over the delete (an edit implies the user still wants the entry). The deletion is discarded and the user is notified.
- **Storage quota exceeded**: New entries cannot sync until the user deletes old entries or the quota is increased. Local entries continue to work normally — sync is paused, not blocked.
- **Many simultaneous devices**: The system supports up to 10 concurrent devices per account (enforced server-side via device registration limit).
- **Clock skew between devices**: Conflict resolution must account for devices with inaccurate clocks. The server should timestamp sync operations rather than relying solely on device timestamps.
- **Existing local vault migration**: Users upgrading from the MVP have local vaults with no account. The upgrade flow must require account creation while preserving existing local data. If account creation fails (e.g., network issue), the user must not lose access to their local vault — they should be allowed to retry.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication

- **FR-001**: System MUST allow users to create an account using email/password with verification, or via social login (GitHub, Google). Social login providers MUST be configured in Auth0 on the free tier.
- **FR-002**: System MUST authenticate users via a trusted managed identity provider (Auth0) before granting access to sync features. The provider MUST support SPA-compatible authentication flows, built-in brute-force protection, email verification, and social identity providers (GitHub, Google).
- **FR-003**: System MUST enforce that account authentication credentials are independent from the vault encryption passphrase. Compromising the account credential MUST NOT expose encrypted journal data.
- **FR-004**: System MUST lock out accounts after 10 consecutive failed authentication attempts within a 15-minute window, with a lockout duration of 15 minutes.
- **FR-005**: System MUST provide email-based account credential recovery.
- **FR-005a**: System MUST require all users to have an account. Existing users upgrading from the local-only MVP MUST be prompted to create an account on first launch after upgrade. Local vault data MUST be preserved during migration and synced to the server once the account is established.

#### Session Management

- **FR-006**: System MUST provide a "lock" action that clears the vault encryption key from memory, requires the vault passphrase to resume, and preserves both local data and the authenticated session. The lock action MUST be accessible via: (1) a persistent lock icon in the app header/top bar visible on all screens, (2) a lock option in the account menu, and (3) the keyboard shortcut Shift+Meta+L.
- **FR-007**: System MUST provide a "logout" action that ends the authenticated session, disconnects from sync, and offers the user a choice to keep or clear local data. The logout action MUST be accessible via the account menu.
- **FR-008**: System MUST preserve existing auto-lock behavior (configurable inactivity timeout, lock on tab blur).

#### Cross-Device Sync

- **FR-009**: System MUST sync journal entries (title, body, tags, status, timestamps), settings, and vault metadata across all devices where the user is authenticated and the vault is unlocked.
- **FR-010**: System MUST encrypt all synced data end-to-end using the user's vault passphrase as the encryption key source. The server MUST never have access to plaintext journal content.
- **FR-011**: System MUST support offline operation — changes made while offline are queued and synced automatically when connectivity is restored.
- **FR-012**: System MUST resolve sync conflicts using a last-write-wins strategy based on server-assigned timestamps, and MUST notify the user when a conflict has been resolved.
- **FR-013**: System MUST support initial device setup where a new device downloads and decrypts all existing entries after the user authenticates and provides the vault passphrase.
- **FR-014**: System MUST propagate entry deletions across all synced devices.
- **FR-014a**: System MUST display a global sync status indicator in the app header showing the current sync state: synced, syncing, offline, or error. The indicator MUST update in real time as sync state changes.

#### Abuse Protection

- **FR-015**: System MUST rate-limit API requests per IP address for unauthenticated endpoints and per account for authenticated endpoints.
- **FR-016**: System MUST throttle account creation from a single IP address and require additional verification (e.g., CAPTCHA) when the threshold is exceeded.
- **FR-017**: System MUST enforce a per-account storage quota for synced data.
- **FR-018**: System MUST reject malformed or oversized requests before processing.

#### Data Governance

- **FR-019**: System MUST allow users to delete their account, which permanently removes all server-side data associated with that account.
- **FR-020**: System MUST allow users to export all their data in a portable JSON format.

### Key Entities

- **User Account**: Represents a registered user. Associated with an email address, authentication state, and a set of registered devices. Independent from vault encryption — the account credential and vault passphrase are separate secrets.
- **Device**: Represents a specific browser/device where the user has logged in. Tracks sync state (last sync timestamp, pending changes). A user may have multiple active devices.
- **Sync Record**: An encrypted blob representing a journal entry, setting, or vault metadata change. Contains the encrypted payload, a version identifier, the originating device, and a server-assigned timestamp. The server stores only the encrypted form.
- **Session**: The combination of authentication state (logged in/out) and vault state (locked/unlocked). A session can be: unauthenticated, authenticated+locked, or authenticated+unlocked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set up a second device and access their full journal within 5 minutes of creating an account.
- **SC-002**: All data stored on the sync server is end-to-end encrypted; no plaintext user content is accessible to the server operator at any time.
- **SC-003**: The app remains fully functional offline — users can create, edit, and read entries without connectivity. Sync initiates automatically within 30 seconds of connectivity returning (sync completion time governed by SC-005).
- **SC-004**: Monthly hosting costs for the sync service remain under $5 for up to 1,000 active users.
- **SC-005**: 95% of sync operations complete within 2 seconds on a standard broadband connection.
- **SC-006**: Unauthorized or rate-limited API requests are rejected within 100 milliseconds.
- **SC-007**: A user with 10 failed login attempts is locked out; legitimate users can recover access via email within 2 minutes.
- **SC-008**: Users can lock or log out of a session in under 2 seconds with clear visual confirmation of the action taken.
- **SC-009**: No single infrastructure compromise (server breach, database leak) can expose unencrypted user journal content.

## Clarifications

### Session 2026-02-21

- Q: Which managed authentication provider should the system use? → A: Auth0
- Q: Where should the lock button be placed in the UI? → A: Both — lock icon in app header for quick access, plus lock and logout options in an account menu. Also add keyboard shortcut Shift+Meta+L for lock.
- Q: What is the migration path for existing local-only vault users? → A: Account required — all users must create an account on upgrade; local-only mode is removed.
- Q: Should users see real-time sync status feedback? → A: Global status indicator — a subtle icon in the app header showing overall sync state (synced, syncing, offline, error).
- Q: Should social login providers be enabled alongside email/password? → A: Yes — email/password + GitHub + Google. Auth0 free tier supports all three.
- Q: Can users change their vault passphrase (requiring re-encryption of all data)? → A: Out of scope for v1, but this is a beta-blocking gap — must be implemented before the first public beta release.

## Assumptions

- **Credential separation**: Account authentication credentials (email + password/token) are kept independent from the vault encryption passphrase. This follows the standard pattern for E2EE systems (Signal, 1Password) where auth and encryption are separate concerns. Compromising the auth server does not expose encrypted data.
- **Zero-knowledge preservation**: The sync server operates as an encrypted blob store. It never has access to the vault passphrase or derived encryption keys. All encryption/decryption happens client-side.
- **Personal use only**: This feature is for a single user syncing across their own devices. Multi-user collaboration, shared journals, and public sharing are explicitly out of scope.
- **Account required (no local-only mode)**: After this feature ships, all users must have an account. The local-only mode from the MVP is removed. Existing users are migrated by requiring account creation on first launch after upgrade, with local data preserved.
- **Conflict resolution — last-write-wins**: For this iteration, conflicts from concurrent offline edits are resolved by server-assigned timestamp (most recent wins). The losing version is discarded but the user is notified. Future iterations may introduce version history or manual conflict resolution.
- **Remote device revocation out of scope**: Users cannot remotely wipe or deauthorize individual devices in this iteration. Changing the account password prevents further sync on unauthorized devices. Full device management is a future enhancement.
- **Constitution evolution**: The existing project principle "Privacy-First, Local-Only Data" evolves to "Privacy-First, End-to-End Encrypted Data" — data may traverse a server for sync purposes but is never readable by the server. The project constitution should be updated to reflect this.
- **Data recovery via sync**: Once sync is enabled, the server-stored encrypted data acts as a backup. If a device loses its IndexedDB (browser storage pressure, device reset), the user can recover by logging in and re-syncing.
- **Storage quotas**: Per-account storage limits will be set at a level that keeps hosting costs within SC-004 targets. The specific limit is an implementation detail but should accommodate at least 10,000 journal entries per account.

## Scope Exclusions

- Multi-user collaboration or shared journals
- Remote device management / remote wipe
- End-to-end encrypted file attachments (images, audio) — text-only sync
- Self-hosted sync server option (single operator-managed service)
- Offline account creation (account creation requires internet)
- Vault passphrase recovery (zero-knowledge — unrecoverable by design)
- Vault passphrase change (requires re-encryption of all synced data and coordinated re-sync across devices). **⚠ BETA-BLOCKING**: This exclusion is temporary. Passphrase change MUST be implemented before the first public beta release — users must be able to rotate their encryption passphrase.

## Dependencies

- **001-mvp-core**: Existing vault, encryption, and Dexie.js infrastructure
- **003-cd-pipeline**: CI/CD pipeline for deploying sync service alongside the PWA
- **Auth0**: Managed identity provider for user authentication, email verification, brute-force protection, and account recovery (free tier: 25,000 MAU)
