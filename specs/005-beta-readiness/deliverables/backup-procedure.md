# D1 Backup and Recovery Procedure

**Date**: 2026-02-23 | **Database**: `reflog-sync` (production), `reflog-sync-preview` (preview)

## Backup Strategy (4 Tiers)

### Tier 1: D1 Time Travel (Always-On)

- **What**: Automatic point-in-time recovery built into D1
- **Retention**: 7 days (free tier), 30 days (Workers Paid, $5/mo)
- **Granularity**: Per-minute
- **Action required**: None — always enabled

**To restore to a point in time**:
```bash
# List available bookmarks
wrangler d1 time-travel info reflog-sync --remote

# Restore to a specific timestamp
wrangler d1 time-travel restore reflog-sync --remote --timestamp="2026-02-23T10:00:00Z"
```

### Tier 2: Pre-Migration Snapshot

Run before every schema migration:

```bash
# Create a named backup before migration
wrangler d1 backup create reflog-sync --remote

# Then run the migration
wrangler d1 execute reflog-sync --remote --file=packages/sync-api/src/db/schema.sql
```

**Recovery**: If migration causes issues within 7 days, use Time Travel to restore to pre-migration state.

### Tier 3: Weekly Local Download

Download a local SQLite copy weekly for offline archival:

```bash
# List available backups
wrangler d1 backup list reflog-sync --remote

# Download the most recent backup
wrangler d1 backup download reflog-sync <backup-id> --remote --output=backups/reflog-sync-$(date +%Y%m%d).sqlite
```

**Storage**: Keep local SQLite files in a secure location (not in the git repo). At 50 users with 2 MB each, weekly backups are ~100 MB.

### Tier 4: Upgrade Path

When accepting paying users, upgrade to Workers Paid ($5/mo):
- D1 Time Travel retention extends from 7 days to 30 days
- Higher D1 read/write limits
- Guaranteed Cron Trigger execution

## Recovery Scenarios

### Scenario 1: Accidental Data Deletion (User)

**Cause**: User accidentally deletes entries
**Recovery**: Entries are soft-deleted (tombstoned) for 90 days. If within 90 days, the encrypted payloads still exist in D1 as tombstone records. Recovery requires:
1. Query tombstoned records for the user
2. Flip `is_tombstone` back to 0
3. User's client will pull the restored records on next sync

### Scenario 2: Bad Schema Migration

**Cause**: A DDL change breaks the application
**Recovery**:
1. `wrangler rollback --name=reflog-sync-api --yes` to restore previous Worker version
2. `wrangler d1 time-travel restore reflog-sync --remote --timestamp=<pre-migration>` to restore DB
3. Fix the migration, redeploy

### Scenario 3: Complete D1 Database Loss

**Cause**: Catastrophic Cloudflare failure (extremely unlikely)
**Recovery**:
1. If within Time Travel window: `wrangler d1 time-travel restore`
2. If beyond Time Travel window: Restore from latest local SQLite backup
3. Create new D1 database, import from SQLite, update wrangler.toml with new ID

### Scenario 4: Account Compromise

**Cause**: Unauthorized access to Cloudflare account
**Recovery**:
1. Rotate Cloudflare API tokens
2. Rotate Auth0 client secrets
3. Use Time Travel to verify no unauthorized data modifications
4. Notify affected users

## Preview Database

The preview database (`reflog-sync-preview`) uses the identical procedure. Replace `reflog-sync` with `reflog-sync-preview` in all commands.

Preview data is ephemeral — no long-term backup needed. Time Travel provides sufficient protection for development/testing.

## Verification Checklist

- [ ] Time Travel is enabled (automatic on D1)
- [ ] Pre-migration snapshot taken before each deploy
- [ ] Weekly local backup downloaded and stored securely
- [ ] Recovery procedure tested at least once (restore to a test database)
