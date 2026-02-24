# Reflog

**For the commits you didn't push.**

Reflog is a privacy-first developer journal that runs entirely in your browser. All entries are encrypted client-side with AES-256-GCM before touching IndexedDB — no telemetry, no analytics, zero-knowledge server.

## Why

Developers think in fragments: debugging breakthroughs, architecture decisions, things that worked and things that didn't. Most of it never gets written down. Reflog is a fast, keyboard-driven place to capture those thoughts before they evaporate.

## Features

- **Client-side encryption** — AES-256-GCM with PBKDF2 key derivation (100k iterations). Your passphrase never leaves the browser.
- **Encrypted cloud sync** — End-to-end encrypted sync across devices via Cloudflare D1. The server only sees ciphertext.
- **Offline-first PWA** — Works without a network connection. Install it as a standalone app from any Chromium or Firefox browser.
- **Markdown editor** — CodeMirror 6 with syntax highlighting, GFM support, and a live preview tab.
- **Full-text search** — MiniSearch-powered fuzzy search with prefix matching and title boosting. Opens instantly with `Cmd/Ctrl+K`.
- **Tags** — Inline `#hashtags` are extracted automatically. Filter the timeline by one or more tags (AND logic).
- **Keyboard-first** — `Cmd/Ctrl+N` new entry, `Cmd/Ctrl+K` search, `Cmd/Ctrl+Enter` save. All shortcuts work from inside the editor.
- **Auto-lock** — Vault locks on tab switch and after 5 minutes of inactivity. Drafts are preserved.
- **Invite-only beta** — Controlled access with invite codes and a public waitlist.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TanStack Start (SPA mode) |
| UI | Mantine v8 |
| Editor | CodeMirror 6 via @uiw/react-codemirror |
| Client Storage | Dexie.js (IndexedDB) with transparent encryption middleware |
| Search | MiniSearch |
| Crypto | Web Crypto API (PBKDF2 + AES-256-GCM) |
| PWA | vite-plugin-pwa + manual service worker |
| Sync API | Hono v4.x on Cloudflare Workers |
| Server DB | Cloudflare D1 (SQLite on edge) |
| Auth | Auth0 (PKCE flow) |
| Build | Vite 7 |
| Tests | Vitest (unit/integration) + Playwright (E2E) |
| CI/CD | GitHub Actions → Cloudflare Pages + Workers |

## Project Structure

This is a Yarn Classic workspaces monorepo with four packages:

```
packages/
  web/          @reflog/web        — PWA frontend (TanStack Start + React + Mantine)
  sync-api/     reflog-sync-api    — Cloudflare Worker (Hono + D1)
  cli/          @reflog/cli        — Admin CLI for invite management (Commander.js)
  shared/       @reflog/shared     — Shared TypeScript types across packages
tests/
  e2e/          Playwright browser tests
specs/          Feature specifications and deliverables
```

### Key directories inside `packages/web/`

```
src/
  components/     React components (editor, search, tags, timeline, vault, auth)
  db/             Dexie database + encryption middleware
  hooks/          Custom React hooks (useVault, useEntries, useAutoLock)
  routes/         TanStack Router file-based routes
  services/       Business logic (crypto, entries, search, tags, keyboard, sync)
  types/          TypeScript type definitions
  content/        Static content (legal pages as Markdown)
public/
  sw.js           Service worker for offline caching
  icons/          PWA icons
```

## Getting Started

```bash
git clone https://github.com/gcoonrod/reflog.git
cd reflog
yarn install        # Installs all workspace dependencies from root
yarn workspace @reflog/web dev   # Start web dev server on port 3000
```

Open [http://localhost:3000](http://localhost:3000) and create a vault with a passphrase (8+ characters).

### Worker (sync API)

```bash
# Local development (requires wrangler login)
yarn workspace reflog-sync-api dev

# Deploy to Cloudflare Workers
yarn workspace reflog-sync-api deploy
```

### CLI (admin tools)

```bash
# Configure environment
cp packages/cli/.env.example packages/cli/.env
# Edit .env with Auth0 and D1 credentials

# Run CLI commands
yarn workspace @reflog/cli start invite create user@example.com
yarn workspace @reflog/cli start invite list
yarn workspace @reflog/cli start waitlist list
yarn workspace @reflog/cli start config get max_beta_users
```

## Scripts

Run from the repository root:

```bash
# Web app
yarn workspace @reflog/web dev           # Dev server (port 3000)
yarn workspace @reflog/web build         # Production build
yarn workspace @reflog/web preview       # Serve production build
yarn workspace @reflog/web typecheck     # TypeScript check
yarn workspace @reflog/web lint          # ESLint
yarn workspace @reflog/web test          # Unit + integration tests (Vitest)

# Sync API (Worker)
yarn workspace reflog-sync-api dev       # Local Worker dev
yarn workspace reflog-sync-api typecheck # TypeScript check
yarn workspace reflog-sync-api deploy    # Deploy to Cloudflare

# Shared types
yarn workspace @reflog/shared typecheck  # TypeScript check

# CLI
yarn workspace @reflog/cli typecheck     # TypeScript check

# Cross-workspace
yarn test:e2e                            # Playwright E2E tests (requires web build)
```

## How Encryption Works

1. On vault creation, a random 16-byte salt is generated and stored in IndexedDB (unencrypted).
2. Your passphrase is run through PBKDF2 (SHA-256, 100k iterations) with the salt to derive an AES-256-GCM key.
3. The key is held in memory only — it's never persisted to disk.
4. Every write to the `entries` table transparently encrypts `title`, `body`, and `tags` fields via a Dexie middleware. Each field gets a unique 12-byte IV.
5. On read, fields are decrypted in-place before reaching application code.
6. When the vault locks (tab switch, inactivity, or manual lock), the key is cleared from memory and the search index is destroyed.
7. Synced entries are encrypted on-device before upload — the server only stores ciphertext.

## License

MIT
