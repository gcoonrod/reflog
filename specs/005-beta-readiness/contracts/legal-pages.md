# Contract: Legal Pages

**Routes**: `/terms`, `/privacy`

## Terms of Service Page

**Route**: `/terms`
**Authentication**: None required (public page)
**Content**: Static markdown rendered as HTML
**Accessibility**: Linked from app footer, waitlist signup form, and Auth0 signup flow

**Key sections** (standard SaaS template):
- Acceptance of terms
- Description of service
- User accounts and responsibilities
- Acceptable use policy
- Intellectual property (user owns their data)
- Limitation of liability
- Termination and data handling
- Beta disclaimer (service provided "as-is" during beta)
- Changes to terms
- Contact information

---

## Privacy Policy Page

**Route**: `/privacy`
**Authentication**: None required (public page)
**Content**: Static markdown rendered as HTML
**Accessibility**: Linked from app footer, waitlist signup form (with consent checkbox), and Auth0 signup flow

**Key sections** (standard SaaS template):
- Data collected and purposes
  - Account data (email, Auth0 profile): authentication and account management
  - Encrypted journal entries: synced as ciphertext only; server cannot read content
  - Waitlist emails: beta access coordination only
  - Operational metadata (device IDs, timestamps, record types): sync functionality
- Data NOT collected
  - No analytics, tracking, or telemetry
  - No third-party data sharing
  - No advertising data
- Encryption and security
  - All journal content encrypted on-device with user's passphrase
  - Server stores and transmits only ciphertext
  - Server has zero knowledge of user content
- Data retention and deletion
  - Account deletion removes all server-side data (CASCADE)
  - Local data persists on device until user clears it
  - Waitlist emails deleted upon request
- User rights (GDPR/CCPA baseline)
  - Right to access (data export feature exists)
  - Right to deletion (account deletion feature exists)
  - Right to data portability (JSON export)
- Contact information
- Changes to policy

---

## Implementation Notes

- Both pages are static content — no server-side rendering required
- Content stored as markdown files in the `packages/web` workspace, rendered via `react-markdown` (already a dependency)
- Pages are accessible without authentication (public routes outside the `_app` layout)
- Footer links added to the app shell and the waitlist/landing page
