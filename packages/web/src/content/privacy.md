# Privacy Policy

**Effective Date**: February 2026
**Last Updated**: February 2026

## 1. Data We Collect

### Account Data
- **Email address**: Used for authentication and account recovery
- **Auth0 profile**: Authentication provider manages login credentials

### Encrypted Journal Entries
- **Ciphertext only**: All journal content is encrypted on your device before transmission. The server stores and transmits only encrypted data (ciphertext). We have **zero knowledge** of your journal content.
- **Record metadata**: Record type (entry or setting), timestamps, device identifiers, and payload size are stored alongside the ciphertext for sync coordination.

### Waitlist Data
- **Email address**: Collected if you join the beta waitlist, used solely for beta access coordination.

### Operational Metadata
- **Device identifiers**: Random UUIDs assigned to each device you register for sync
- **Timestamps**: When records are created and updated, when devices were last active
- **Storage usage**: Total bytes of encrypted data stored per account

## 2. Data We Do NOT Collect

- **No analytics or telemetry**: We do not track page views, clicks, sessions, or usage patterns
- **No third-party tracking**: No advertising pixels, analytics scripts, or tracking cookies
- **No data sharing**: We do not sell, rent, or share your data with third parties
- **No content access**: We cannot read your journal entries — encryption keys never leave your device

## 3. Encryption and Security

- All journal content is encrypted on your device using your passphrase before any data leaves the browser
- The server stores and transmits only ciphertext (encrypted data)
- We use AES-GCM encryption with keys derived from your passphrase via PBKDF2
- **Zero-knowledge architecture**: The server has no access to your encryption keys or plaintext content
- Transport encryption (HTTPS/TLS) protects data in transit in addition to the application-layer encryption

## 4. Data Retention and Deletion

- **Account deletion**: Deleting your account permanently removes all server-side data, including encrypted entries, device records, and account metadata. This operation uses cascading deletion and is irreversible.
- **Local data**: Data stored locally on your device persists until you clear it manually through the application or browser settings.
- **Waitlist data**: Waitlist email addresses are deleted upon request or when no longer needed for beta coordination.
- **Tombstone records**: Deleted entries are marked as tombstones and permanently purged from the server after 90 days.

## 5. Your Rights

We support the following data rights, consistent with GDPR and CCPA principles:

- **Right to access**: You can export all your data at any time using the built-in data export feature (Settings > Export Data). The export includes all your encrypted records in JSON format.
- **Right to deletion**: You can delete your account at any time, which permanently removes all server-side data.
- **Right to data portability**: The JSON export format allows you to take your data with you.
- **Right to rectification**: You can edit or update your journal entries at any time through the application.

To exercise any of these rights, use the corresponding features in the application or contact us at the address below.

## 6. Changes to This Policy

We may update this privacy policy from time to time. We will notify registered users of material changes via email. The "Last Updated" date at the top of this page indicates when the policy was last revised.

## 7. Contact

For questions about this privacy policy or your data, contact us at privacy@reflog.microcode.io.
