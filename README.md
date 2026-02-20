# Reflog

**For the commits you didn't push.**

Reflog is a privacy-first developer journal that runs entirely in your browser. All entries are encrypted client-side with AES-256-GCM before touching IndexedDB — no server, no account, no telemetry.

## Why

Developers think in fragments: debugging breakthroughs, architecture decisions, things that worked and things that didn't. Most of it never gets written down. Reflog is a fast, keyboard-driven place to capture those thoughts before they evaporate.

## Features

- **Client-side encryption** — AES-256-GCM with PBKDF2 key derivation (100k iterations). Your passphrase never leaves the browser.
- **Offline-first PWA** — Works without a network connection. Install it as a standalone app from any Chromium or Firefox browser.
- **Markdown editor** — CodeMirror 6 with syntax highlighting, GFM support, and a live preview tab.
- **Full-text search** — MiniSearch-powered fuzzy search with prefix matching and title boosting. Opens instantly with `Cmd/Ctrl+K`.
- **Tags** — Inline `#hashtags` are extracted automatically. Filter the timeline by one or more tags (AND logic).
- **Keyboard-first** — `Cmd/Ctrl+N` new entry, `Cmd/Ctrl+K` search, `Cmd/Ctrl+Enter` save. All shortcuts work from inside the editor.
- **Auto-lock** — Vault locks on tab switch and after 5 minutes of inactivity. Drafts are preserved.
- **Zero dependencies on external services** — No backend, no analytics, no CDN. Deploy the static build anywhere.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TanStack Start (SPA mode) |
| UI | Mantine v8 |
| Editor | CodeMirror 6 via @uiw/react-codemirror |
| Storage | Dexie.js (IndexedDB) with transparent encryption middleware |
| Search | MiniSearch |
| Crypto | Web Crypto API (PBKDF2 + AES-256-GCM) |
| PWA | vite-plugin-pwa + manual service worker |
| Build | Vite 7 |
| Tests | Vitest (unit/integration) + Playwright (E2E) |

## Getting Started

```bash
git clone https://github.com/your-username/reflog.git
cd reflog
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) and create a vault with a passphrase (8+ characters).

## Scripts

```bash
yarn dev          # Start dev server on port 3000
yarn build        # Production build
yarn preview      # Serve production build locally
yarn typecheck    # TypeScript strict mode check
yarn lint         # ESLint
yarn test         # Unit + integration tests (Vitest)
yarn test:e2e     # E2E tests (Playwright, requires build first)
```

## Project Structure

```
src/
  components/     # React components (editor, search, tags, timeline, vault)
  db/             # Dexie database + encryption middleware
  hooks/          # Custom React hooks (useVault, useEntries, useAutoLock)
  routes/         # TanStack Router file-based routes
  services/       # Business logic (crypto, entries, search, tags, keyboard)
  types/          # TypeScript type definitions
  utils/          # Date formatting, helpers
tests/
  unit/           # Vitest unit tests
  integration/    # DB encryption, search performance
  e2e/            # Playwright browser tests (37 specs)
public/
  sw.js           # Service worker for offline caching
  icons/          # PWA icons
```

## How Encryption Works

1. On vault creation, a random 16-byte salt is generated and stored in IndexedDB (unencrypted).
2. Your passphrase is run through PBKDF2 (SHA-256, 100k iterations) with the salt to derive an AES-256-GCM key.
3. The key is held in memory only — it's never persisted to disk.
4. Every write to the `entries` table transparently encrypts `title`, `body`, and `tags` fields via a Dexie middleware. Each field gets a unique 12-byte IV.
5. On read, fields are decrypted in-place before reaching application code.
6. When the vault locks (tab switch, inactivity, or manual lock), the key is cleared from memory and the search index is destroyed.

## License

MIT
