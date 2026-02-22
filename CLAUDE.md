# reflog Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-19

## Active Technologies
- TypeScript 5.x (strict mode), Node.js 22.x (LTS) + GitHub Actions (runner: `ubuntu-24.04`), `yarn` v1.x (Classic) (002-ci-pipeline)
- N/A (CI infrastructure only) (002-ci-pipeline)
- YAML (GitHub Actions), Bash (inline scripts), Node.js 22.x (for version extraction) + GitHub Actions, Cloudflare Pages (via `cloudflare/wrangler-action@v3`), `wrangler` CLI (003-cd-pipeline)
- N/A (CD infrastructure only) (003-cd-pipeline)
- TypeScript 5.x (strict mode, no `any`) — both client and Worker + `@auth0/auth0-react` v2.15.0, Hono v4.x, `jose` v6.x, Dexie.js v4.3 (004-auth-and-sync)
- Client: IndexedDB via Dexie.js (existing) | Server: Cloudflare D1 (SQLite on edge) (004-auth-and-sync)

- TypeScript 5.x (strict mode, no `any`) + TanStack Start v1.161+ + Router, React 19, Mantine v8, Dexie.js v4.3, MiniSearch v7.2, vite-plugin-pwa v1.2, CodeMirror 6 (001-mvp-core)

## Project Structure

```text
src/
tests/
```

## Commands

yarn typecheck && yarn lint && yarn test && yarn build && yarn test:e2e

## Code Style

TypeScript 5.x (strict mode, no `any`): Follow standard conventions

## Recent Changes
- 004-auth-and-sync: Added TypeScript 5.x (strict mode, no `any`) — both client and Worker + `@auth0/auth0-react` v2.15.0, Hono v4.x, `jose` v6.x, Dexie.js v4.3
- 003-cd-pipeline: Added YAML (GitHub Actions), Bash (inline scripts), Node.js 22.x (for version extraction) + GitHub Actions, Cloudflare Pages (via `cloudflare/wrangler-action@v3`), `wrangler` CLI
- 002-ci-pipeline: Added TypeScript 5.x (strict mode), Node.js 22.x (LTS) + GitHub Actions (runner: `ubuntu-24.04`), `yarn` v1.x (Classic)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
