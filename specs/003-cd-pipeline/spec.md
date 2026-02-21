# Feature Specification: CD Pipeline and Production Hosting

**Feature Branch**: `003-cd-pipeline`
**Created**: 2026-02-21
**Status**: Draft
**Input**: User description: "Write up the phased approach recommendation as a spec. Include a new CD workflow for GitHub Actions to auto deploy on pushes to main. This should include guards to ensure that all CI checks have passed, a new version is set, and a CHANGELOG.md entry is included."

## Context

Reflog is a client-side PWA currently with no production hosting. A hosting research report (`docs/hosting-research.md`) evaluated options and recommended a phased approach starting with Cloudflare Pages for free static hosting, with a path to adding a backend and eventual homelab migration.

This specification covers the initial deployment: hosting the static PWA at `reflog.microcode.io`, with an automated continuous delivery pipeline that deploys on every push to `main` after verifying quality, versioning, and changelog requirements.

## User Scenarios & Testing

### User Story 1 - Automated Production Deployment (Priority: P1)

As a developer, when I merge a release branch to `main`, the application is automatically built and deployed to production at `reflog.microcode.io` without any manual steps -- provided all quality checks pass, the version has been bumped, and a changelog entry exists.

**Why this priority**: Without automated deployment, there is no production site. This is the core value of the feature.

**Independent Test**: Merge a release branch to `main` that has a bumped version and a CHANGELOG.md entry. Verify the CD workflow runs, passes all guards, and the updated application is live at `reflog.microcode.io`.

**Acceptance Scenarios**:

1. **Given** a push to `main` with a new version in `package.json` and a corresponding CHANGELOG.md entry, **When** the CD workflow triggers, **Then** the application is built and deployed to the production hosting environment
2. **Given** a push to `main` where the version has not changed from the previous deployment, **When** the CD workflow triggers, **Then** the deployment is skipped and the workflow reports that no new version was detected
3. **Given** a push to `main` where the version is new but no CHANGELOG.md entry exists for that version, **When** the CD workflow triggers, **Then** the deployment is blocked and the workflow reports the missing changelog entry
4. **Given** a push to `main` where CI checks have not passed on the source branch, **When** the CD workflow triggers, **Then** the deployment is blocked and the workflow reports the failed quality gate
5. **Given** a successful deployment, **When** a user visits `reflog.microcode.io`, **Then** the application loads correctly with the newly deployed version

---

### User Story 2 - Production Hosting at Custom Domain (Priority: P2)

As a user, I can access Reflog at `reflog.microcode.io` over HTTPS. The site loads quickly from a global CDN with automatic SSL certificate management.

**Why this priority**: The hosting infrastructure must exist before the CD workflow can deploy to it. However, this is a one-time setup that unblocks US1.

**Independent Test**: After initial hosting setup, visit `https://reflog.microcode.io` and verify the site loads with a valid SSL certificate and the PWA installs correctly.

**Acceptance Scenarios**:

1. **Given** the hosting environment is configured, **When** a user navigates to `https://reflog.microcode.io`, **Then** the application loads with a valid SSL certificate
2. **Given** the hosting environment is configured, **When** a user navigates to `http://reflog.microcode.io`, **Then** they are redirected to HTTPS
3. **Given** the application is deployed, **When** a user visits from any geographic region, **Then** the content is served from a nearby CDN edge node
4. **Given** the application is deployed, **When** a user installs the PWA, **Then** the service worker and manifest are served correctly and the app is installable

---

### User Story 3 - Changelog-Driven Release Notes (Priority: P3)

As a developer, I maintain a CHANGELOG.md file that documents what changed in each version. The CD pipeline enforces that every deployed version has a corresponding changelog entry, ensuring a reliable history of production changes.

**Why this priority**: Changelog enforcement improves release discipline but is not strictly required for deployment to function. It is a quality gate that prevents undocumented releases.

**Independent Test**: Attempt to deploy a version without a CHANGELOG.md entry and verify the pipeline blocks it. Then add the entry and verify the pipeline proceeds.

**Acceptance Scenarios**:

1. **Given** a CHANGELOG.md file exists with an entry matching the current version in `package.json`, **When** the CD workflow runs, **Then** the changelog guard passes
2. **Given** no CHANGELOG.md file exists, **When** the CD workflow runs, **Then** the deployment is blocked with a clear error message
3. **Given** a CHANGELOG.md file exists but has no entry for the current version, **When** the CD workflow runs, **Then** the deployment is blocked with a message indicating which version entry is missing

---

### Edge Cases

- What happens when `main` receives a push that only changes non-application files (e.g., docs, specs, README)? The CD workflow should still run its guards; if the version has not changed, it skips deployment gracefully.
- What happens if the hosting provider is temporarily unavailable during deployment? The workflow should fail with a clear error and allow re-running.
- What happens if two pushes to `main` occur in rapid succession? The CD workflow should use concurrency controls to queue runs and deploy each in order, never canceling an in-progress deployment.
- What happens on the very first deployment when no previous version exists to compare against? The workflow should treat the first push as a new version and deploy.

## Requirements

### Functional Requirements

- **FR-001**: The CD workflow MUST trigger automatically on every push to `main`
- **FR-002**: The CD workflow MUST verify that CI quality checks (lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit) have passed before deploying
- **FR-003**: The CD workflow MUST verify that the version in `package.json` has changed compared to the previously deployed version before deploying
- **FR-004**: The CD workflow MUST verify that CHANGELOG.md contains an entry for the current version before deploying
- **FR-005**: The CD workflow MUST build the application and deploy the output to the production hosting environment
- **FR-006**: The CD workflow MUST skip deployment gracefully (without failing) when the version has not changed
- **FR-007**: The CD workflow MUST fail with a clear error message when the changelog entry is missing for the current version
- **FR-008**: The CD workflow MUST use concurrency controls to prevent overlapping deployments, queuing newer runs behind any in-progress deployment
- **FR-009**: The production site MUST be accessible at `https://reflog.microcode.io` with a valid SSL certificate
- **FR-010**: The production site MUST redirect HTTP requests to HTTPS
- **FR-011**: The production site MUST serve the application from a global CDN
- **FR-012**: The production site MUST correctly serve the PWA manifest and service worker for installability
- **FR-013**: A DNS record MUST be configured in Route 53 to point `reflog.microcode.io` to the hosting provider
- **FR-014**: The CHANGELOG.md MUST follow a consistent format with version headers that can be parsed programmatically
- **FR-015**: The CD workflow MUST report deployment status (success, skipped, or failed) clearly in the workflow run summary

### Key Entities

- **Version**: The semantic version string in `package.json` that identifies each release
- **Changelog Entry**: A section in CHANGELOG.md documenting changes for a specific version, parseable by the CD workflow
- **Deployment**: The process of building the application and publishing the output to the production hosting environment
- **Quality Gate**: The set of CI checks that must pass before a deployment is permitted

## Success Criteria

### Measurable Outcomes

- **SC-001**: Deployments from push-to-main to live-on-production complete within 5 minutes
- **SC-002**: The production site at `reflog.microcode.io` achieves a Lighthouse performance score of 90 or higher
- **SC-003**: Every version deployed to production has a corresponding CHANGELOG.md entry (100% changelog coverage)
- **SC-004**: Zero deployments occur when CI checks have not passed (quality gate is never bypassed)
- **SC-005**: The production site has an uptime of 99.9% or higher (measured over 30 days)
- **SC-006**: The production hosting incurs $0/month in costs for the current static PWA at low traffic levels
- **SC-007**: The CD workflow correctly skips deployment when no version change is detected, without reporting a failure

## Assumptions

- The hosting provider for Phase 1 is Cloudflare Pages, as recommended in `docs/hosting-research.md`. This provides free static hosting with unlimited bandwidth, automatic SSL, and global CDN.
- The domain `microcode.io` is managed via AWS Route 53, and a CNAME record will be added for the `reflog` subdomain.
- The CHANGELOG.md format follows the Keep a Changelog convention (https://keepachangelog.com), with version headers like `## [0.2.0] - 2026-02-21`.
- The CD workflow will use a deployment token or API key stored as a GitHub repository secret to authenticate with the hosting provider.
- Branch protection rules on `main` already require PRs, which ensures CI checks run before code reaches `main`. The CD workflow's CI guard is an additional safety net.
- Future phases (backend hosting, homelab migration) are out of scope for this specification and will be covered by separate feature specs.

## Out of Scope

- Backend API hosting (Phase 2 from the hosting research)
- Homelab migration (Phase 3 from the hosting research)
- Custom domain email or DNS configuration beyond the `reflog` subdomain
- Monitoring, alerting, or observability infrastructure
- Rollback mechanisms (the hosting provider maintains deployment history natively)
- Blue/green or canary deployment strategies
