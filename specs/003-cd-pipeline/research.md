# Research: CD Pipeline and Production Hosting

**Date**: 2026-02-21 | **Feature**: 003-cd-pipeline

## R1: Cloudflare Pages Deployment from GitHub Actions

**Decision**: Use `cloudflare/wrangler-action@v3` with `pages deploy` command to deploy the `dist/client` directory.

**Rationale**: Officially supported action from Cloudflare. Wraps wrangler CLI, handles authentication, and exposes deployment URLs as step outputs. Avoids Cloudflare's built-in GitHub integration, which would take over the build process and prevent custom CI gating.

**Alternatives considered**:
- Cloudflare's built-in GitHub integration: Rejected -- replaces your CI pipeline with Cloudflare's build system, losing control over deployment gates.
- Raw wrangler CLI via npm install: Works but requires manual installation, auth handling, and output parsing.
- Cloudflare Pages API directly: More complex, no advantage over the action.

**Key details**:
- Secrets needed: `CLOUDFLARE_API_TOKEN` (Account/Pages/Edit permission), `CLOUDFLARE_ACCOUNT_ID`
- One-time project creation: `npx wrangler pages project create reflog --production-branch=main`
- Deploy command: `pages deploy dist/client --project-name=reflog --branch=main --commit-hash=<sha>`
- Deployment URL available via: `${{ steps.deploy.outputs.deployment-url }}`

## R2: Version Comparison in CD Workflows

**Decision**: Compare `package.json` version against existing git tags. Deploy only if `v<version>` tag does not exist. Create tag after successful deployment.

**Rationale**: Git tags are the canonical source of truth for released versions. Simple, reliable, and idempotent -- if a deployment fails before tagging, the next run re-attempts. No external state storage needed.

**Alternatives considered**:
- Compare package.json between HEAD and HEAD~1: Fragile with merge commits; fails to detect deployment failures.
- Check against deployed artifact/API: Adds runtime dependency on the hosting provider being reachable.
- Use a dedicated tag/release trigger: Extra manual step; version-in-package.json is more ergonomic.

**Key details**:
- Extract version: `node -p "require('./package.json').version"`
- Check tag: `git rev-parse "v$VERSION" >/dev/null 2>&1`
- Requires `fetch-depth: 0` and `fetch-tags: true` on checkout
- Requires `contents: write` permission to push tags

## R3: Changelog Validation in GitHub Actions

**Decision**: Inline shell grep for `^## \[<version>\]` pattern in CHANGELOG.md. No third-party action.

**Rationale**: The check is trivial -- a single grep. Adding a third-party action for pattern matching is unnecessary overhead with supply chain risk. The inline approach is transparent and debuggable.

**Alternatives considered**:
- `dangoslen/changelog-enforcer@v3`: Designed for PR enforcement, not CD version validation.
- Custom Node.js script: Overkill for pattern matching.
- No validation: Risky -- allows silent releases with no documentation.

**Key details**:
- Keep a Changelog format: `## [x.y.z] - YYYY-MM-DD`
- Validation: `grep -qE "^## \[${VERSION}\]" CHANGELOG.md`
- Uses `::error::` annotation for clear failure messages in workflow UI

## R4: CI Check Verification in CD Workflows

**Decision**: Use `workflow_run` trigger with `types: [completed]` and `branches: [main]`, filtering on `conclusion == 'success'`.

**Rationale**: Purpose-built for CI→CD chaining. Decouples CI from CD while maintaining the dependency. Branch protection is the belt, `workflow_run` is the suspenders -- defense in depth. The CI workflow must also trigger on `push: branches: [main]` (not just PRs) for this to work.

**Alternatives considered**:
- Rely solely on branch protection: Admins can bypass. Also, branch protection prevents merging but does not prevent a push trigger from firing.
- Check commit status via API: Adds complexity (polling, race conditions). `workflow_run` handles this natively.
- Single workflow with CI + CD jobs: Couples CI and CD. Changes to CI affect CD. CD would also run on PRs.
- Redundant CI re-run in CD: Wasteful -- CI already ran.

**Key details**:
- `workflows` value must match CI workflow `name:` exactly (case-sensitive): `'CI'`
- CI workflow needs `push: branches: [main]` added to its trigger
- The `workflow_run` event fires on the default branch

## R5: Cloudflare Pages Custom Domain Setup

**Decision**: Add `reflog.microcode.io` as custom domain in Cloudflare Pages dashboard, then create a CNAME record in Route 53 pointing to `reflog.pages.dev`.

**Rationale**: Cloudflare Pages supports custom subdomains with external DNS. Since `reflog.microcode.io` is a subdomain, a CNAME is sufficient. No DNS transfer to Cloudflare needed.

**Alternatives considered**:
- Transfer DNS to Cloudflare: Unnecessary for a subdomain. Complicates management of `microcode.io`.
- Use default `reflog.pages.dev` only: Works but lacks professional branding.

**Key details**:
- Custom domain must be added in Pages dashboard FIRST, then CNAME created
- Route 53: CNAME `reflog.microcode.io` -> `reflog.pages.dev` (TTL 300)
- SSL: Automatically provisioned by Cloudflare
- CAA records: Must allow `digicert.com`, `letsencrypt.org`, `pki.goog` (or have no CAA records)
- No TXT verification needed for subdomains

## R6: Concurrency Controls for CD Workflows

**Decision**: Use `concurrency` with a static group name `production-deploy` and `cancel-in-progress: false` (queue, do not cancel).

**Rationale**: Canceling an in-progress deployment is dangerous -- could leave assets in a partial state and skip the tagging step. Queuing ensures every triggered deployment completes in order. Concurrent triggers should be rare since deployments are gated by version changes.

**Alternatives considered**:
- `cancel-in-progress: true`: Appropriate for CI but dangerous for deployments.
- No concurrency control: Overlapping wrangler deploys may conflict.
- Job-level concurrency: No advantage over workflow-level for a single-job workflow.
