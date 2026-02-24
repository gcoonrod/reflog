# Pricing Model: Reflog

**Date**: 2026-02-23 | **Status**: Draft for Beta Validation

## Tier Comparison

| Feature | Free | Pro |
|---------|------|-----|
| Encrypted journal entries | Unlimited | Unlimited |
| Offline-first storage | Unlimited local | Unlimited local |
| Cloud sync | 25 MB | 500 MB |
| Devices | 2 | 10 |
| Export (JSON) | Yes | Yes |
| Search (local) | Yes | Yes |
| Price | $0 | $4.99/mo or $50/yr (~16% annual discount) |

## Free Tier Value Justification

The free tier provides the complete core journaling experience:
- Create, edit, delete encrypted journal entries
- Full offline-first capability (works without internet)
- Local search across all entries
- Data export in JSON format
- Cloud sync across 2 devices with 25 MB storage

**25 MB supports approximately 12,500 plaintext entries** at ~2 KB per entry (including encryption overhead). For a daily journal, this is over 34 years of entries.

The free tier is deliberately generous with entry count but limited on sync infrastructure (storage and device count), which are the cost-intensive resources.

## Upgrade Triggers

Users are prompted to upgrade when they:
1. **Storage limit**: Approach or exceed 25 MB of synced encrypted data
2. **Device limit**: Try to register a 3rd device for sync
3. **Natural growth**: Regular journaling across multiple devices

## Annual Discount Rationale

- Monthly: $4.99/mo = $59.88/yr
- Annual: $50/yr = $4.17/mo effective
- Discount: ~16% ($9.88 saved)
- Standard SaaS annual discount range (15-20%)

## User Validation Plan

**Target**: 5+ beta testers understand the tier difference (SC-005: 80% comprehension)

**Method**:
1. Present tier comparison to beta users during the first month
2. Ask: "What would you lose if you stayed on free?" (expect: sync storage/devices)
3. Ask: "What does Pro give you?" (expect: more storage, more devices)
4. Ask: "Would you pay $4.99/mo for Pro?" (collect signal)
5. 4/5 correct answers = 80% comprehension target met

## Cost Projection at 50 Beta Users

| Item | Monthly Cost |
|------|-------------|
| Cloudflare Workers (free tier) | $0 |
| Cloudflare D1 (free tier: 5M reads, 100K writes) | $0 |
| Auth0 (free tier: 7,500 MAU) | $0 |
| Domain (reflog.microcode.io) | ~$1 (annualized) |
| **Total** | **~$1/mo** |

At 50 users with average 2 MB storage each = 100 MB total D1 storage. Well within D1 free tier limits (5 GB).

## Post-Beta: Payment Processing

Payment processor selected: **Lemon Squeezy** (Merchant of Record)

| Price Point | Fee | Effective Rate |
|-------------|-----|----------------|
| $4.99/mo | ~$0.75 | ~15% |
| $50/yr | ~$3.00 | ~6% |

See `payment-processors.md` for full comparison and rationale.

## Notes

- Tier enforcement (25 MB / 2 devices on free tier) is explicitly deferred to post-beta
- During beta, all users get existing limits: 50 MB storage, 10 devices
- Pricing will be validated with beta users before enforcement code is written
