# Feature Specification: Beta Readiness

**Feature Branch**: `005-beta-readiness`
**Created**: 2026-02-23
**Status**: Draft
**Input**: Research spec for consumer-ready limited beta — gap analysis, invite system, preview environment, pricing, payment processors, and future feature roadmap.

## Clarifications

### Session 2026-02-23

- Q: How does the operator manage invites (generate tokens, view waitlist, set user cap)? → A: CLI tool — a script the operator runs locally to generate invites and manage the beta.
- Q: What are the concrete free-tier limits (storage quota, device count)? → A: 25 MB storage and 2 devices. Paid tier raises or removes these limits.
- Q: What is the paid tier price point? → A: $4.99/month or $50/year (~16% annual discount).
- Q: What is out of scope for the beta launch? → A: Payment implementation is deferred post-beta. Beta is free for all invited users. Pricing is designed now as research; payments are built after beta.
- Q: Are legal pages (ToS, privacy policy) in scope for this feature or deferred? → A: In scope — ship ToS and privacy policy pages as part of beta readiness, using standard SaaS templates.
- Q: Should the preview environment deploy per PR or track the develop branch? → A: Track develop — the preview environment deploys automatically when commits are pushed to the develop branch, providing a stable staging URL rather than per-PR previews.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invite-Only Beta Access (Priority: P1)

As the operator, I want to limit who can sign up for Reflog during the beta period so that I can control costs, gather focused feedback from a manageable group, and avoid abuse from uncontrolled public registration.

As an invited user, I want to receive a clear invitation that lets me sign up seamlessly, so I feel welcomed and can start using Reflog without friction.

**Why this priority**: Without signup control, costs scale unpredictably. An invite system is the single most important gate for a managed beta — it caps the user population, protects infrastructure budgets, and creates exclusivity that drives engagement.

**Independent Test**: Can be fully tested by running the CLI tool to generate an invite, sending it to a test email, and verifying that only users with a valid invite can complete account creation. Uninvited users who visit the signup page see a waitlist or "invite required" message.

**Acceptance Scenarios**:

1. **Given** a new visitor with no invite, **When** they navigate to the app, **Then** they see a landing page explaining the beta is invite-only with an option to request access (join a waitlist).
2. **Given** the operator has generated an invite for a specific email, **When** the invited user signs up with that email, **Then** they are granted full access and the invite is marked as consumed.
3. **Given** a user has already consumed an invite, **When** the same invite link or code is used again, **Then** signup is denied with a message that the invite has been used.
4. **Given** the operator sets a maximum of 50 beta users, **When** the 51st user tries to sign up with a valid invite, **Then** they are informed the beta is currently at capacity and added to the waitlist.

---

### User Story 2 - Preview Environment for Pre-Production Testing (Priority: P2)

As a developer, I want a preview environment that mirrors production but contains no real user data, so that I can test changes, demo features, and run acceptance checks before deploying to production.

**Why this priority**: Without a staging/preview environment, every deploy goes straight to production. This is the highest-risk gap after signup control — preview environments prevent regressions from reaching beta users.

**Independent Test**: Can be tested by merging a change to develop, verifying the stable preview URL loads with the latest changes, performs sync operations against a separate database, and does not share data with production.

**Acceptance Scenarios**:

1. **Given** a commit is pushed to the `develop` branch, **When** the CI pipeline runs, **Then** the preview environment is deployed to a stable preview URL (e.g., `develop.reflog.pages.dev`) that is accessible to the developer.
2. **Given** a preview deployment is running, **When** a user interacts with it, **Then** all data operations (sync, storage) use a separate preview database that contains no production data.
3. **Given** the preview environment is already deployed, **When** a new commit is pushed to `develop`, **Then** the preview environment is updated in-place with the latest changes.
4. **Given** the preview environment, **When** authentication is attempted, **Then** it uses a separate identity provider configuration (or test credentials) that does not affect production user accounts.

---

### User Story 3 - Pricing Model and Free-Tier Design (Priority: P3)

As the operator, I want a pricing model with a meaningful free tier and attractive paid upgrades, so that users can experience Reflog's value before committing financially, while the paid tier generates revenue that sustains the service.

**Why this priority**: Pricing must be designed before launch even if payment processing is deferred. The free tier's limits determine infrastructure costs, and the upgrade incentives determine monetization potential. Getting this wrong creates either a dead free tier (no engagement) or an unsustainable giveaway (no revenue).

**Independent Test**: Can be validated by documenting the pricing tiers, presenting them to 5+ potential users, and confirming that at least 80% understand the value proposition and can articulate why they would or would not upgrade.

**Acceptance Scenarios**:

1. **Given** the pricing model document is complete, **When** it defines the free tier, **Then** it specifies concrete limits (storage quota, device count) that allow a user to experience core journaling value (create entries, sync, search, tag) without hitting limits that make the product unusable within 30 days of normal use.
2. **Given** the pricing model document is complete, **When** it defines the paid tier, **Then** it includes a clear upgrade trigger mechanism (what limit is hit, what the user sees) and the paid tier substantially raises or removes free-tier limits at $4.99/month or $50/year.
3. **Given** the pricing model document is presented to 5+ potential users, **When** they review the tier comparison, **Then** at least 80% can articulate the value difference between free and paid tiers without prompting (SC-005).
4. **Given** the pricing model document is complete, **When** cost projections are included, **Then** infrastructure costs at 50 beta users remain under $10/month (SC-002) and the document explains how free-tier limits control cost growth.

---

### User Story 4 - Payment Processing Research for PWA (Priority: P4) *(research only — implementation deferred post-beta)*

As the operator, I want to evaluate payment processors that work within a PWA context, so that when the beta concludes and paid tiers are activated, the payment integration can be implemented with a well-informed choice.

**Why this priority**: Payment processing is a prerequisite for monetization but is deferred past beta launch. During beta, all invited users have free access. This story produces a research deliverable (processor comparison), not working code.

**Independent Test**: Can be validated by producing a comparison document evaluating at least 3 payment processors against fee structure, PWA compatibility, and Merchant of Record status, with a clear recommendation and rationale.

**Acceptance Scenarios**:

1. **Given** the research is complete, **When** at least 3 payment processors are evaluated, **Then** each includes fee calculations at both $4.99/month and $50/year price points, Merchant of Record status, and PWA checkout compatibility.
2. **Given** the comparison document, **When** the recommended processor is identified, **Then** it includes a rationale explaining the tradeoff between fee percentage and operational burden (tax compliance, billing infrastructure).
3. **Given** the recommended processor, **When** its sandbox/test mode is evaluated, **Then** the document confirms it supports embedded or overlay checkout without leaving the Reflog domain and webhook delivery compatible with Cloudflare Workers.
4. **Given** the comparison document, **When** cost projections are included, **Then** processing fees at 100 paying subscribers are calculated for both monthly and annual billing cycles with blended revenue estimates.

---

### User Story 5 - Production Gap Analysis and Operational Readiness (Priority: P5)

As the operator, I want a clear assessment of what is missing between the current deployment and a consumer-ready beta, so that I can prioritize work, budget appropriately, and launch with confidence.

**Why this priority**: This is a meta-story — it produces the prioritized gap list that informs all other work. It is lower priority as a user story because it is a research output, not a user-facing feature, but its findings drive the roadmap.

**Independent Test**: Can be validated by producing a gap analysis document that covers infrastructure, security, observability, data integrity, and user experience — and having the operator confirm no major categories are missing.

**Acceptance Scenarios**:

1. **Given** the current production deployment, **When** the gap analysis is completed, **Then** it categorizes gaps as Critical (must fix before beta), Important (should fix within first month), and Nice-to-Have (can defer).
2. **Given** the gap analysis, **When** cost estimates are included, **Then** each gap includes an estimated monthly cost impact and whether it fits within the <$10/month target.
3. **Given** the gap analysis, **When** reviewed against industry standards for consumer apps, **Then** it covers: error monitoring, backups, abuse prevention, legal/privacy compliance, and onboarding experience.

---

### User Story 6 - Future Feature Roadmap (Priority: P6)

As the operator, I want a speculative roadmap of features that would differentiate Reflog in the crowded note-taking market, so that I can plan development priorities beyond the beta and communicate a compelling vision to early users.

**Why this priority**: Lowest priority because it is purely speculative and has no immediate implementation requirement. However, it informs marketing messaging and helps focus post-beta development.

**Independent Test**: Can be validated by producing a feature comparison matrix against 3-5 competing products (e.g., Obsidian, Notion, Bear, Standard Notes) and identifying at least 3 differentiators unique to Reflog's positioning.

**Acceptance Scenarios**:

1. **Given** the roadmap is produced, **When** compared against competing products, **Then** at least 3 proposed features are not available (or not well-served) in mainstream note-taking apps.
2. **Given** the roadmap, **When** features are categorized, **Then** each feature includes estimated complexity (Small, Medium, Large), user impact (Low, Medium, High), and alignment with Reflog's core value proposition (encrypted, offline-first journaling).

---

### Edge Cases

- What happens when an invite is generated but the recipient never signs up? Invites expire after 30 days by default.
- What happens when the operator revokes access for a beta user? The user's sync stops working but local data remains accessible offline — no data is deleted without the user's consent.
- What happens when a preview environment's separate database drifts from production schema? Preview deployments run the same migration scripts as production; schema drift is prevented by using identical deployment artifacts.
- *(Post-beta — applies when payment processing is implemented)* What happens when a paying user's subscription lapses while they are offline? On next sync, the server returns a "subscription expired" status. The client shows a grace-period notice and disables sync after the grace period ends, but local read/write continues indefinitely.
- What happens when monthly costs approach the $10 target? The operator receives an alert (email or dashboard notification) when projected costs reach 80% of the budget cap.
- What happens when the Terms of Service or Privacy Policy needs updating? The operator updates the static content and redeploys. Existing users are not required to re-accept during beta; material changes are communicated via email.

### Out of Scope for Beta

- **Payment processing implementation**: No billing, subscription management, or payment collection during beta. All invited beta users have free access. Payment integration is a post-beta milestone.
- **Tier enforcement in code**: Free-tier limits (25 MB, 2 devices) are designed but not enforced during beta. All beta users operate under the existing 50 MB / 10 device limits. Enforcement ships alongside payment processing. This includes FR-015 (plan status display) and FR-016 (limit notifications), which are meaningless without enforced tiers and are deferred to the same post-beta milestone.
- **Analytics and A/B testing**: No user behavior tracking, feature flags for experimentation, or conversion funnels during beta.
- **Internationalization (i18n)**: English only for beta. Localization is a post-launch consideration.
- **Native app store distribution**: Reflog remains a PWA. No iOS/Android app store submissions during or immediately after beta.

## Requirements *(mandatory)*

### Functional Requirements

**Invite System**

- **FR-001**: Operator MUST be able to generate invite tokens tied to a specific email address via a CLI tool run locally.
- **FR-002**: System MUST reject account creation for emails without a valid, unconsumed invite token.
- **FR-003**: Operator MUST be able to set a maximum beta user cap (default: 50 users) via the CLI tool.
- **FR-004**: System MUST provide a waitlist page for unauthenticated visitors who do not have an invite.
- **FR-005**: System MUST expire unused invites after a configurable period (default: 30 days).
- **FR-006**: Each invite token MUST be single-use — consumed on successful signup.
- **FR-028**: The CLI tool MUST support: generating invites (single or batch), listing pending/consumed/expired invites, viewing the waitlist, revoking invites, and setting the beta user cap.

**Preview Environment**

- **FR-007**: System MUST deploy the `develop` branch to a stable preview URL that is accessible without production credentials. The preview updates automatically on each push to `develop`.
- **FR-008**: Preview deployments MUST use a separate database instance that contains no production data.
- **FR-009**: The preview environment is a single persistent deployment tracking `develop`. It is overwritten in-place on each push. No per-PR previews or teardown logic is required.
- **FR-010**: Preview deployments MUST use a separate authentication configuration so test accounts do not pollute production identity records.

**Pricing and Tiers**

- **FR-011**: System MUST define at least two tiers: Free and a paid tier.
- **FR-012**: Free tier MUST provide enough functionality to demonstrate Reflog's core value (create entries, sync across a limited number of devices, search, and tag).
- **FR-013**: Free tier MUST impose the following limits: 25 MB storage quota and a maximum of 2 synced devices.
- **FR-014**: Paid tier MUST substantially raise or remove the free-tier limits (storage quota and device count). Priced at $4.99/month or $50/year.
- **FR-015**: System MUST display current plan status and usage to the user within the application.
- **FR-016**: System MUST notify users when they approach or exceed free-tier limits with non-intrusive, actionable messages.

**Payment Processing**

- **FR-017**: System MUST support at least one payment processor that works within a PWA context (no native app store requirement).
- **FR-018**: Payment flow MUST be completable without navigating away from the Reflog domain.
- **FR-019**: System MUST support subscription lifecycle management: create, upgrade, downgrade, cancel, and renewal. MUST support both monthly ($4.99) and annual ($50) billing cycles.
- **FR-020**: System MUST handle failed payments with a grace period before downgrading the user.
- **FR-021**: Payment processing fees MUST be below 10% of gross revenue at 100+ paying subscribers.

**Legal Pages**

- **FR-029**: System MUST display a Terms of Service page accessible from the app footer and during signup.
- **FR-030**: System MUST display a Privacy Policy page accessible from the app footer and during signup.
- **FR-031**: Both legal pages MUST be in place before the first invite is sent to a real user.
- **FR-032**: Waitlist signup (FR-004) MUST include explicit consent to store the user's email address, with a link to the privacy policy.

**Gap Analysis**

- **FR-022**: Gap analysis MUST cover: error monitoring/observability, database backups, abuse prevention, legal/privacy (terms of service, privacy policy), and onboarding experience.
- **FR-023**: Each identified gap MUST be categorized by severity (Critical, Important, Nice-to-Have) and include a cost estimate.
- **FR-024**: Gap analysis MUST confirm total projected monthly operating cost remains under $10 for the beta user cap.

**Future Roadmap**

- **FR-025**: Roadmap MUST include a competitive analysis against at least 3 existing note-taking products.
- **FR-026**: Roadmap MUST propose at least 3 differentiating features not well-served by competitors.
- **FR-027**: Each proposed feature MUST include estimated complexity and user impact ratings.

### Key Entities

- **Invite**: A single-use token associated with an email address, an expiration date, a status (pending, consumed, expired, revoked), and the user account it created (if consumed). Belongs to the beta program.
- **Waitlist Entry**: An email address and signup timestamp from unauthenticated visitors who request access. Used by the operator to decide who to invite next.
- **Pricing Tier**: A named plan (e.g., Free, Pro) with associated limits. Free tier: 25 MB storage, 2 devices. Paid tier: higher or unlimited storage and devices. Each user belongs to exactly one tier at any time.
- **Subscription**: A billing relationship between a user and a paid tier, including payment method reference, billing cycle (monthly at $4.99 or annual at $50), status (active, past_due, canceled), and start/end dates. Only exists for paid-tier users.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Beta user population does not exceed the operator-defined cap (default 50) at any point during the managed beta period.
- **SC-002**: Total monthly infrastructure cost remains below $10 for the duration of the beta (measured via hosting provider billing dashboards).
- **SC-003**: 90% of invited users successfully complete signup and create their first entry within 10 minutes of clicking the invite link.
- **SC-004**: Preview environment deploys are available within 5 minutes of a push to `develop` and reflect the latest develop state at a stable URL.
- **SC-005**: The pricing model is validated with at least 5 potential users, and 80% can articulate the value difference between free and paid tiers without prompting.
- **SC-006**: At least one payment processor is identified that charges under 10% per transaction at the $4.99/month price point (or under 5% on the $50/year plan) and supports in-app checkout for PWAs.
- **SC-007**: The gap analysis covers all 5 categories (observability, backups, abuse prevention, legal/privacy, onboarding) with severity ratings and cost estimates.
- **SC-008**: The future roadmap identifies at least 3 features not available in Obsidian, Notion, or Standard Notes that align with Reflog's encrypted offline-first positioning.

## Assumptions

- Auth0 free tier (7,500 MAU) is sufficient for a 50-user beta. If the beta scales beyond the free tier limit, Auth0 costs will need to be factored in.
- Cloudflare Workers and D1 free/paid tiers provide enough capacity for 50 beta users syncing normal journal volumes (estimated <1 GB total data, <10,000 API calls/day).
- The operator is a solo developer — there is no dedicated operations team, so observability and incident response must be low-maintenance (automated alerts, not dashboards requiring active monitoring).
- The PWA distribution model means Apple App Store and Google Play Store payment requirements (30% commission) do not apply — Reflog is accessed via browser.
- Users are comfortable with browser-based payment flows (e.g., Stripe Checkout or embedded payment forms) and do not expect native app store billing.
- The beta period is expected to last 2-3 months before a public launch decision.
- Legal pages (Terms of Service, Privacy Policy) are in scope for this feature and will use standard SaaS templates. Custom legal counsel is not required for beta, but pages must be live before the first invite is sent.
