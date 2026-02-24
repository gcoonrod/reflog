# Competitive Analysis & Future Feature Roadmap

**Date**: 2026-02-23 | **Status**: Research Deliverable

## Competitive Landscape

### Comparison Matrix

| Feature | Reflog | Obsidian | Notion | Bear | Standard Notes |
|---------|--------|----------|--------|------|----------------|
| **E2E Encryption** | Yes (AES-GCM, zero-knowledge) | No (Obsidian Sync not E2E by default) | No | No | Yes |
| **Offline-first** | Yes (IndexedDB, full PWA) | Yes (local files) | Partial (cache) | Yes (local) | Yes |
| **Cloud sync** | Yes (Cloudflare D1) | Paid add-on ($8/mo) | Built-in | iCloud only | Paid ($90/yr) |
| **Open source** | No (planned) | Partially (app, not sync) | No | No | Yes |
| **Web app** | Yes (PWA) | No (desktop + mobile) | Yes | No (Apple only) | Yes |
| **Keyboard-driven** | Yes (Vim-inspired) | Yes (extensive) | Partial | Partial | No |
| **Pricing (free)** | 25 MB sync, 2 devices | Local only, no sync | Free (limited blocks) | Free (1 device) | Free (limited) |
| **Pricing (paid)** | $4.99/mo | $8/mo (sync only) | $8-10/mo | $1.49/mo | $90/yr ($7.50/mo) |
| **Platform** | Web (PWA) | Desktop + Mobile | Web + Desktop + Mobile | Apple only | Web + Desktop + Mobile |
| **Content type** | Journal entries (Markdown) | Notes (Markdown) | Notes/Docs/Databases | Notes (Markdown) | Notes (plaintext/Markdown) |

### Positioning

Reflog occupies a unique position: **encrypted, offline-first journaling for developers**. No competitor offers all of:
1. True E2E encryption with zero-knowledge server
2. Offline-first PWA (no app store, instant updates)
3. Keyboard-driven interface
4. Developer-centric design (Markdown, monospace, minimal)

## Differentiating Feature Proposals

### Feature 1: Time-Based Entry Timeline

**Description**: Visual timeline view of journal entries, grouped by day/week/month, with heatmap showing writing frequency.

| Attribute | Rating |
|-----------|--------|
| Complexity | Small |
| User Impact | High |
| Core Alignment | High — reinforces daily journaling habit |

**Rationale**: No competitor offers a journal-specific timeline. Obsidian has calendar plugins but they're note-centric, not journal-centric. A built-in timeline reinforces the daily writing habit.

### Feature 2: Encrypted File Attachments

**Description**: Attach images, PDFs, or files to journal entries. Files are encrypted on-device with the same key as text content. Stored in R2 (Cloudflare object storage).

| Attribute | Rating |
|-----------|--------|
| Complexity | Medium |
| User Impact | High |
| Core Alignment | High — extends encryption promise to all content |

**Rationale**: Users want to include screenshots, photos, or documents with journal entries. Current competitors either don't encrypt attachments (Obsidian, Notion) or don't support them at all (Standard Notes free tier). R2 storage is $0.015/GB/month — minimal cost impact.

### Feature 3: Local AI Summarization (On-Device)

**Description**: Use WebLLM or ONNX runtime to run a small language model in the browser for entry summarization, weekly digests, and writing prompts — all on-device, no server involvement.

| Attribute | Rating |
|-----------|--------|
| Complexity | Large |
| User Impact | Medium |
| Core Alignment | High — AI without compromising encryption |

**Rationale**: This is the most differentiating feature. AI integration in journaling apps typically requires sending data to a server, breaking the encryption model. Running inference on-device preserves zero-knowledge while adding AI-powered features. No competitor does this.

### Feature 4: Entry Templates and Prompts

**Description**: Configurable entry templates (e.g., "Daily standup", "Retrospective", "Gratitude") with Markdown scaffolding. Optional random writing prompts.

| Attribute | Rating |
|-----------|--------|
| Complexity | Small |
| User Impact | Medium |
| Core Alignment | Medium — useful for habitual journaling |

**Rationale**: Low-cost feature that increases daily active usage. Templates reduce friction for daily journaling. Writing prompts help users maintain the habit when they're unsure what to write about.

## Roadmap Phases

### Phase 1: Beta Launch (Current)
- Invite-only access, legal pages, waitlist
- Core journaling: create, edit, delete, search
- E2E encrypted sync across devices

### Phase 2: Post-Beta (Q2 2026)
- Payment integration (Lemon Squeezy)
- Free/Pro tier enforcement
- Entry templates and prompts
- Time-based entry timeline
- Public registration (remove invite gate)

### Phase 3: Growth (Q3 2026)
- Encrypted file attachments (R2)
- Weekly email digest (encrypted summary, processed on-device)
- Mobile-optimized PWA improvements
- Obsidian import/export

### Phase 4: Differentiation (Q4 2026)
- On-device AI summarization
- Entry tagging and categorization improvements
- API for third-party integrations
- Consider open-sourcing the client

## Notes

- All features must maintain the zero-knowledge encryption guarantee (Constitution Principle I)
- On-device processing is preferred over server-side for any content-aware features
- Roadmap is speculative — validated with beta user feedback before commitment
