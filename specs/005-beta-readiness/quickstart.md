# Quickstart: Beta Readiness

**Branch**: `005-beta-readiness` | **Date**: 2026-02-23

## A1. Monorepo Migration

The repo restructures from a flat layout to Yarn Classic workspaces:

**Before**:
```
src/                    # UI app
workers/sync-api/       # Worker (separate package.json + yarn.lock)
tests/                  # Tests
```

**After**:
```
packages/
  web/                  # UI app (moved from src/)
  sync-api/             # Worker (moved from workers/sync-api/)
  cli/                  # New operator CLI tool
  shared/               # Shared types (@reflog/shared)
tests/                  # UI tests (stays at root)
```

**Root `package.json` workspace config**:
```json
{
  "private": true,
  "workspaces": {
    "packages": ["packages/*"],
    "nohoist": [
      "**/wrangler", "**/wrangler/**",
      "**/@cloudflare/workers-types", "**/@cloudflare/workers-types/**"
    ]
  }
}
```

**Key migration steps**:
1. Move `src/` → `packages/web/src/`, along with `vite.config.ts`, `vitest.config.ts`, `postcss.config.cjs`, `public/` (note: `playwright.config.ts` stays at root, updated to reference `packages/web/` for webServer config)
2. Move `workers/sync-api/` → `packages/sync-api/`, remove its `yarn.lock`
3. Create `packages/shared/` with types extracted from `src/types/sync.ts`
4. Create `packages/cli/` scaffold
5. Update root `package.json` with workspace config
6. Update all import paths (`@/*` alias stays within `packages/web/`)
7. Run `yarn install` to generate unified lockfile
8. Update CI workflow to install at root and run workspace-targeted commands

**Cross-package imports**:
```typescript
// In packages/web/src/services/syncApi.ts
import type { SyncRecord, PushRequest } from '@reflog/shared';

// In packages/sync-api/src/routes/sync.ts
import type { SyncRecord, PushRequest } from '@reflog/shared';

// In packages/cli/src/commands/invite.ts
import type { Invite } from '@reflog/shared';
```

## A2. Invite System Integration

**Auth0 setup**:
1. Disable public signup: Auth0 Dashboard → Authentication → Database → Settings → uncheck "Disable Sign Ups"
2. Create Management API application (Machine-to-Machine) for CLI tool
3. Add pre-user-registration Action as safety net

**CLI invite flow**:
```bash
# Generate invite
reflog-cli invite create user@example.com
# → Creates Auth0 account via Management API
# → Inserts invite record in D1
# → Triggers password-reset email to user

# List invites
reflog-cli invite list --status pending

# View waitlist
reflog-cli waitlist list

# Promote from waitlist
reflog-cli invite create --from-waitlist user@example.com
```

**Client-side gate** (in `_app.tsx` or auth guard):
```
User logs in via Auth0
  → Client calls POST /api/v1/invites/verify with user's email
  → If 200: proceed to app
  → If 403 (invite_required): show "invite required" screen
  → If 403 (beta_full): show "beta at capacity" screen + waitlist option
  → On first successful verification: call POST /api/v1/invites/consume
```

## A3. Preview Environment

**Infrastructure**:
- Preview Worker: `reflog-sync-api-preview` (deployed via `wrangler deploy --env preview`)
- Preview D1: `reflog-sync-preview` (pre-provisioned, persistent)
- Preview Auth0: `reflog-dev` tenant (separate from production)
- Preview Pages: Stable URL at `develop.reflog.pages.dev` (deploys from `develop` branch)

**CI workflow** (new `preview-deploy` job):
```yaml
preview-deploy:
  if: github.ref == 'refs/heads/develop'
  needs: [lint, typecheck, unit-tests]
  steps:
    - Deploy preview Worker (wrangler deploy --env preview)
    - Build frontend with preview env vars (VITE_SYNC_API_URL, VITE_AUTH0_*)
    - Deploy to Pages from develop branch (wrangler pages deploy --branch=develop)
```

## A4. Legal Pages

**Implementation**: Two new public routes (`/terms`, `/privacy`) outside the `_app` auth-gated layout.

**Content source**: Markdown files in `packages/web/src/content/` rendered via `react-markdown`.

**Integration points**:
- App footer: Links to both pages
- Waitlist form: Privacy policy link + consent checkbox
- Auth0 Universal Login: Custom text with links (via Auth0 Dashboard → Branding → Universal Login → Advanced)

## A5. Research Deliverables (No Code)

The following are document outputs, not implementations:

1. **Pricing model document** — Tier comparison table, free vs paid limits, user validation results
2. **Payment processor comparison** — Stripe vs Lemon Squeezy vs Paddle evaluation matrix
3. **Gap analysis report** — Categorized findings with severity and cost estimates
4. **Future feature roadmap** — Competitive matrix + 3+ differentiating feature proposals
5. **D1 backup procedure** — Documented recovery steps using Time Travel

These are written to `specs/005-beta-readiness/` as standalone markdown files during the tasks phase.
