# Data Model: Beta Readiness

**Branch**: `005-beta-readiness` | **Date**: 2026-02-23

## New Entities

### Invite (D1 — server-side)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | NOT NULL, UNIQUE | Invited email address (lowercase, trimmed) |
| token | TEXT | NOT NULL, UNIQUE | Cryptographically random invite token (32 bytes, hex-encoded) |
| status | TEXT | NOT NULL, DEFAULT 'pending' | One of: `pending`, `consumed`, `expired`, `revoked` |
| created_by | TEXT | NOT NULL | Operator identifier (e.g., 'cli') |
| created_at | TEXT | NOT NULL | ISO 8601 timestamp |
| expires_at | TEXT | NOT NULL | ISO 8601 timestamp (default: created_at + 30 days) |
| consumed_at | TEXT | NULL | ISO 8601 timestamp when signup completed |
| consumed_by_user_id | TEXT | NULL | Auth0 user_id of the account created |

**Indexes**:
- `idx_invites_email` on `email`
- `idx_invites_token` on `token`
- `idx_invites_status` on `status`

**State transitions**:
```
pending → consumed   (user signs up with matching email)
pending → expired    (expires_at reached without consumption)
pending → revoked    (operator revokes via CLI)
```

**Validation rules**:
- Email must be valid format (RFC 5322 basic check)
- Token must be unique (cryptographically random, collision probability negligible)
- One active invite per email (reject if pending invite already exists for email)
- Consumed invites cannot be revoked or re-consumed

### Waitlist Entry (D1 — server-side)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | NOT NULL, UNIQUE | Email address requesting access |
| created_at | TEXT | NOT NULL | ISO 8601 timestamp |
| consent | INTEGER | NOT NULL, DEFAULT 1 | Privacy policy consent (1 = consented) |
| invited | INTEGER | NOT NULL, DEFAULT 0 | Whether an invite has been generated for this email |

**Indexes**:
- `idx_waitlist_email` on `email`

**Validation rules**:
- Email must be valid format
- Consent must be 1 (enforced at API layer; no entry without consent)
- Duplicate emails rejected (UNIQUE constraint)

### Beta Config (D1 — server-side)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | TEXT | PRIMARY KEY | Configuration key |
| value | TEXT | NOT NULL | Configuration value |
| updated_at | TEXT | NOT NULL | ISO 8601 timestamp |

**Initial rows**:
- `max_beta_users`: `50`
- `invite_expiry_days`: `30`

## Modified Entities

### Users (existing D1 table)

No schema changes. The `storage_quota_bytes` field already exists (currently 50 MB for all users). Tier enforcement is deferred post-beta per spec Out of Scope.

## Entity Relationships

```
Invite.consumed_by_user_id → Users.user_id  (nullable FK, set on consumption)
Waitlist.email → Invite.email               (logical link; operator creates invite from waitlist)
BetaConfig                                    (standalone key-value store)
```

## Notes

- All new tables live in the existing D1 database (`reflog-sync`). The same schema migration pattern applies: `CREATE TABLE IF NOT EXISTS` in `packages/sync-api/src/db/schema.sql`.
- The preview environment uses a separate D1 database (`reflog-sync-preview`) with identical schema.
- Pricing Tier and Subscription entities from the spec are research deliverables only (deferred post-beta). They are documented in the spec but have no schema in this data model.
- Invite tokens are NOT encrypted — they contain no user content. They are opaque identifiers with no personally identifiable information beyond the associated email, which is operationally necessary per Constitution Principle I (permitted metadata).
