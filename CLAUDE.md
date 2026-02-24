# reflog Development Guidelines

Last updated: 2026-02-23

## Active Technologies

- TypeScript 5.x (strict mode, no `any`)
- Node.js 22.x (LTS), Yarn v1.x (Classic) with workspaces
- React 19, TanStack Start v1.161+ + Router, Mantine v8
- Dexie.js v4.3 (IndexedDB), MiniSearch v7.2, CodeMirror 6, vite-plugin-pwa v1.2
- Hono v4.x (Worker), `jose` v6.x (JWT verification)
- `@auth0/auth0-react` v2.15 (client), Auth0 Management API (CLI)
- Commander.js (CLI), `auth0` SDK v4.x (CLI)
- Cloudflare Workers, Pages, D1 (SQLite on edge)
- GitHub Actions (CI/CD), `wrangler` CLI

## Project Structure

```text
packages/
  web/          # PWA frontend (@reflog/web)
  sync-api/     # Cloudflare Worker API (reflog-sync-api)
  shared/       # Shared types (@reflog/shared)
  cli/          # Operator CLI tool (@reflog/cli)
tests/          # UI unit/integration/contract/E2E tests
specs/          # Feature specifications
.github/        # CI/CD workflows
```

## Commands

```bash
# Typecheck all packages
yarn workspace @reflog/shared typecheck
yarn workspace @reflog/web typecheck
yarn workspace reflog-sync-api typecheck
yarn workspace @reflog/cli typecheck

# Lint and format
yarn workspace @reflog/web lint
yarn workspace @reflog/web format:check

# Tests
yarn workspace @reflog/web test          # Unit/integration tests
yarn test:e2e                            # Playwright E2E tests

# Build
yarn workspace @reflog/web build

# Dev
yarn workspace @reflog/web dev           # Web app on port 3000
yarn workspace reflog-sync-api dev       # Worker dev server
yarn workspace @reflog/cli dev           # CLI via tsx
```

## Code Style

- TypeScript 5.x strict mode, no `any`
- Follow existing patterns in each package
- Web: `@/*` path alias resolves to `packages/web/src/*`
- Worker: Hono middleware pattern with `createMiddleware<AppEnv>()`
- CLI: Commander.js subcommands in `src/commands/`

## Workspace Notes

- Root `yarn install` handles all packages (single lockfile)
- `nohoist` for `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`
- Shared types: import from `@reflog/shared` in web and sync-api
- CLI accesses D1 via `wrangler d1 execute` subprocess (not HTTP)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
