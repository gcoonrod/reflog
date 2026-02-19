# Research: Reflog MVP Core

**Branch**: `001-mvp-core` | **Date**: 2026-02-19 | **Updated**: 2026-02-19

## Version Matrix

| Package | Version | Notes |
|---------|---------|-------|
| `@tanstack/react-start` | ^1.161.1 | Vite plugin, SPA mode via `spa: { enabled: true }` |
| `@tanstack/react-router` | ^1.161.1 | File-based routing, type-safe params |
| `react` / `react-dom` | ^19.0.0 | React 18 also supported; 19 recommended |
| `vite` | ^7.3.1 | Required by TanStack Start v1.161+ |
| `@vitejs/plugin-react` | latest | Vite React plugin |
| `@mantine/core` | ^8.3.15 | v7 (7.17.8) is tagged `legacy`; v8 recommended |
| `@mantine/hooks` | ^8.3.15 | Required peer of @mantine/core |
| `@mantine/spotlight` | ^8.3.15 | Cmd+K search palette |
| `@mantine/notifications` | ^8.3.15 | Toast notifications |
| `dexie` | ^4.3.0 | Stable; DBCore middleware recommended |
| `dexie-react-hooks` | ^4.2.0 | `useLiveQuery` for reactive queries |
| `@uiw/react-codemirror` | ^4.25.4 | Community React wrapper (de facto standard) |
| `@codemirror/lang-markdown` | ^6.5.0 | Official Markdown language support |
| `@codemirror/theme-one-dark` | ^6.1.3 | Dark theme |
| `react-markdown` | ^10.1.0 | ESM-only, React >= 18 |
| `rehype-highlight` | ^7.0.2 | Code block syntax highlighting |
| `remark-gfm` | latest | GitHub Flavored Markdown tables, etc. |
| `minisearch` | ^7.2.0 | Zero deps, ships TS types |
| `vite-plugin-pwa` | ^1.2.0 | Supports Vite 3–7, ships TS types |
| `postcss-preset-mantine` | latest | Recommended for Mantine CSS functions |
| `postcss-simple-vars` | latest | Mantine breakpoint variables |
| `vite-tsconfig-paths` | latest | TypeScript path aliases in Vite |

## 1. TanStack Start for SPA/PWA

**Decision**: Use TanStack Start v1.161+ as a Vite plugin in SPA mode with
`vite-plugin-pwa`.

**Rationale**: TanStack Start is now a native Vite plugin (no longer built on
Vinxi). It supports SPA-only rendering by setting `spa: { enabled: true }` in
the `tanstackStart()` plugin options within `vite.config.ts`. This outputs a
static SPA bundle with no server runtime, perfect for a client-only PWA.
TanStack Router provides file-based routing with type-safe route params.

**Architecture change (from earlier docs)**: TanStack Start dropped Vinxi in
late 2024 and moved to a direct Vite plugin architecture. For full-stack apps,
it uses Nitro for server deployment; for SPA mode, Nitro is not needed. The
configuration file is `vite.config.ts` (not `app.config.ts`).

**Key configuration**:

```typescript
// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Reflog',
        short_name: 'Reflog',
        theme_color: '#1a1b1e',
        background_color: '#1a1b1e',
        display: 'standalone',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
```

**File-based routing** (unchanged):
- `src/routes/__root.tsx` — Root layout (wraps all routes)
- `src/routes/index.tsx` — Index/home route
- `src/routes/$param.tsx` — Dynamic route parameter
- `src/routes/_layout.tsx` — Pathless layout (groups without URL segment)
- Nested via directories: `entry/$id.tsx` = `/entry/:id`
- Auto-generated route tree: `src/routeTree.gen.ts`
- Router instance configured in `src/router.tsx`

**React version**: Both React 18 and 19 supported. Official examples target
React 19. **Recommendation: use React 19** for longest support runway.

**Alternatives considered**:
- TanStack Router alone (without Start): Simpler, but lacks the integrated
  build pipeline and file-based routing scaffolding that Start provides.
- Vite + React Router: Would work, but TanStack Router's type-safe routing
  is superior for a TypeScript-strict project.
- Next.js: Requires server infrastructure, violates the no-backend constraint.

## 2. Mantine UI Component Library

**Decision**: Mantine v8 with CSS modules, dark theme default.

**Rationale**: Mantine v8 (current stable: 8.3.15) uses CSS modules (no runtime
CSS-in-JS) and provides components that map directly to our UI needs. The v7
line (7.17.8) is tagged `legacy` on npm. The v8 breaking changes are in dates,
carousel, and code-highlight packages — NOT in the core components we use
(AppShell, Spotlight, Badge, Tabs, PasswordInput, Notifications).

**Key components mapping**:
- `Spotlight` (`@mantine/spotlight`) → Search palette (Cmd+K) with dynamic
  results. Supports compound component pattern (`Spotlight.Root`,
  `Spotlight.Search`, `Spotlight.ActionsList`) or declarative `actions` prop.
  Default shortcut: `mod + K`.
- `Tabs` → Editor write/preview toggle (variants: `default`, `outline`, `pills`)
- `Badge` → Tag display and filtering (variants: `filled`, `light`, `outline`)
- `AppShell` → Main layout with responsive header/navbar/main
- `PasswordInput` → Passphrase entry with visibility toggle
- `Notifications` (`@mantine/notifications`) → Storage quota warnings, errors

**Spotlight API** (Cmd+K search palette):

```typescript
import { Spotlight, spotlight } from '@mantine/spotlight';

// Programmatic control:
spotlight.open();
spotlight.close();
spotlight.toggle();

// Declarative with actions:
<Spotlight
  actions={actions}
  nothingFound="Nothing found..."
  highlightQuery
  shortcut={['mod + K']}
  searchProps={{ placeholder: 'Search entries...' }}
/>

// Or compound components for dynamic results:
<Spotlight.Root query={query} onQueryChange={setQuery}>
  <Spotlight.Search placeholder="Search..." />
  <Spotlight.ActionsList>
    {filteredItems}
  </Spotlight.ActionsList>
</Spotlight.Root>
```

**Required style imports**:

```typescript
import '@mantine/core/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/notifications/styles.css';
```

**Theme configuration**: Override `fontFamilyMonospace` to `'Fira Code',
'JetBrains Mono', monospace`. Set `defaultColorScheme: 'dark'` on
`MantineProvider`.

**PostCSS setup** (highly recommended):
- `postcss-preset-mantine` — provides `rem()`, `em()`, light/dark mixins
- `postcss-simple-vars` — Mantine breakpoint variables

**Alternatives considered**:
- Chakra UI: Also valid per constitution. Mantine chosen for its Spotlight
  component (native Cmd+K palette) and CSS modules approach (better
  offline performance, no runtime CSS-in-JS).

## 3. Dexie.js + Encryption Strategy

**Decision**: Dexie.js v4.3.0 with custom encryption via DBCore middleware
(`db.use()`) using Web Crypto API (PBKDF2 key derivation + AES-GCM encryption).
Not using the `dexie-encrypted` npm package.

**Rationale**: Dexie v4 is fully stable (4.3.0, Jan 2025). While the legacy
`creating`/`reading`/`updating` hooks still work and are not deprecated, the
**DBCore middleware via `db.use()` is the recommended approach** for intercepting
reads and writes. It provides:
- Asynchronous actions before forwarding calls (critical for async encryption)
- Actions both before and after the forwarded call
- Coverage of all read/write operations through a single interception point
- Full TypeScript support via `DBCore`, `DBCoreTable`, `DBCoreMutateRequest`

**Encryption via DBCore middleware pattern**:

```typescript
import { Dexie } from 'dexie';

db.use({
  stack: "dbcore",
  name: "EncryptionMiddleware",
  create(downlevelDatabase) {
    return {
      ...downlevelDatabase,
      table(tableName) {
        const downlevelTable = downlevelDatabase.table(tableName);
        if (tableName !== 'entries') return downlevelTable;
        return {
          ...downlevelTable,
          mutate: req => {
            // Encrypt title, body, tags before writing
            if (req.values) {
              req = { ...req, values: req.values.map(encryptFields) };
            }
            return downlevelTable.mutate(req);
          },
          get: req => downlevelTable.get(req).then(decryptFields),
          getMany: req => downlevelTable.getMany(req).then(
            results => results.map(r => r ? decryptFields(r) : r)
          ),
        };
      }
    };
  }
});
```

**TypeScript pattern** (v4 recommended):

```typescript
import { Dexie, type EntityTable } from 'dexie';

const db = new Dexie('ReflogDB') as Dexie & {
  entries: EntityTable<Entry, 'id'>;
  vault_meta: EntityTable<VaultMeta, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};
```

**React integration**: `dexie-react-hooks` v4.2.0 (separate package) provides
`useLiveQuery()` for reactive queries that auto-update when data changes.

**Encryption flow**:
1. User provides passphrase → derive AES-256-GCM key via PBKDF2
   (100,000 iterations, random salt stored in `vault_meta`)
2. Store verification blob: encrypt known string, store ciphertext
3. On unlock: derive key, decrypt verification blob, confirm match
4. DBCore middleware: encrypt specified fields on write, decrypt on read
5. On lock: clear derived key and all decrypted data from memory

**Fields encrypted**: Entry `title`, `body`, `tags`. Fields left plaintext
for IndexedDB indexing: `id`, `createdAt`, `updatedAt`, `status`.

**Alternatives considered**:
- `dexie-encrypted` npm package: Uncertain Dexie v4 compatibility,
  less control over key derivation and memory management.
- Dexie hooks API (`creating`/`reading`/`updating`): Still works but
  less powerful than DBCore for async operations like encryption.
- SQLite Wasm + encryption: Heavier bundle, more complex build setup.
  Constitution allows this as alternative but IndexedDB/Dexie is preferred.

## 4. Full-Text Search Strategy

**Decision**: MiniSearch v7.2.0 for in-memory full-text search.

**Rationale**: Since encrypted fields cannot be queried at the IndexedDB
level, search must operate on decrypted data in memory. MiniSearch v7.2.0
is a lightweight, zero-dependency, TypeScript-native full-text search library
with:
- Fast index build time (<100ms for 1,000 documents)
- Sub-millisecond query times
- Fuzzy matching (`fuzzy: 0.2`) and prefix search (`prefix: true`)
- Built-in TypeScript types (no `@types` package needed)
- Incremental add/remove of documents
- Field-specific searching and boosting
- Index is a plain JS object — trivially clearable on vault lock

**Search architecture**:
1. On vault unlock: decrypt all entries, build MiniSearch index
2. Index fields: `title`, `body` (raw Markdown text)
3. On search query: query MiniSearch with debounce (150ms)
4. On entry create/update/delete: incrementally update index via
   `add()`, `remove()`, `search()` methods
5. On vault lock: nullify index reference

**Alternatives considered**:
- Fuse.js: Fuzzy search only, no full-text indexing. Slower for large
  document sets because it scans all documents per query.
- Lunr.js: Proven but larger bundle, immutable index (rebuild required
  on each entry change).
- FlexSearch: Fastest benchmarks but larger bundle and less intuitive API.
- Plain `Array.filter` with `String.includes`: Works for exact matches
  but no fuzzy matching, no relevance ranking.

## 5. Markdown Editor

**Decision**: CodeMirror 6 via `@uiw/react-codemirror` v4.25.4 for raw editing
+ `react-markdown` v10.1.0 with `rehype-highlight` v7.0.2 for rendered preview.

**Rationale**: `@uiw/react-codemirror` is the de facto community standard React
wrapper for CodeMirror 6 (2.1k GitHub stars, actively maintained). It provides a
clean controlled-component API, ships with TypeScript types, and includes dark
theme support via `@codemirror/theme-one-dark`.

**Editor setup**:

```typescript
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';

const extensions = useMemo(() => [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
], []);

<CodeMirror
  value={content}
  theme={oneDark}
  extensions={extensions}
  onChange={(val) => setContent(val)}
/>
```

**Preview rendering**:

```typescript
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

<Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
  {content}
</Markdown>
```

**Keyboard shortcut coexistence**: CodeMirror intercepts key events when
focused. For app-level shortcuts (Cmd+K, Cmd+N) to work while the editor is
focused, use `EditorView.domEventHandlers` to selectively pass through:

```typescript
EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.metaKey && ['k', 'n'].includes(event.key)) {
      return false; // let it bubble to app handlers
    }
  }
})
```

Alternatively, register global shortcuts on the capture phase.

**Performance notes**:
- Memoize the `extensions` array via `useMemo` (new array reference causes
  expensive reconfiguration)
- Consider debouncing `onChange` for auto-save to avoid excessive writes
- `basicSetup` prop is opinionated — consider `basicSetup={false}` with
  manual feature selection for a clean writing experience

**Bundle size**: ~60–70 KB gzipped total (core + Markdown + dark theme +
React wrapper). Significantly smaller than Monaco Editor (~500 KB+).

**Toggle implementation**: Mantine `Tabs` component with "Write" and
"Preview" tabs. Editor state persists when toggling — switching to preview
does not lose cursor position or unsaved edits.

**Alternatives considered**:
- Direct CodeMirror integration (no wrapper): More control but ~40–60 lines
  of boilerplate for lifecycle management. `@uiw/react-codemirror` saves this.
- Monaco Editor: Full VS Code editor, ~2MB bundle. Overkill for a journal.
- `@uiw/react-md-editor`: All-in-one but tightly couples editor and
  preview, less control over styling and keyboard integration.
- Plain `<textarea>`: Simplest but no syntax awareness, no line numbers,
  poor UX for Markdown-heavy writing.

## 6. Testing Strategy

**Decision**: Vitest for unit/integration tests + Playwright for E2E.

**Rationale**: Vitest is the natural testing framework for Vite-based
projects. TanStack Start is now a Vite plugin, so Vitest shares Vite's
config and transform pipeline — TypeScript/JSX works out of the box.
Playwright handles E2E testing including PWA-specific scenarios (service
worker interception, offline simulation, install prompts).

**Test categories**:
- Unit: Crypto utilities, tag parsing, search index operations
- Integration: Dexie database operations with encryption middleware
- E2E: Full user journeys (setup, write, search, tag, keyboard nav, offline)

**Alternatives considered**:
- Jest: Would require separate TypeScript/ESM configuration. Vitest is
  simpler with Vite projects.
- Cypress: Viable for E2E but Playwright has better PWA/service worker
  testing support.

## 7. PWA Tooling

**Decision**: `vite-plugin-pwa` v1.2.0 with Workbox for service worker
generation.

**Rationale**: `vite-plugin-pwa` supports Vite 3–7 and integrates directly
into `vite.config.ts` as a plugin alongside `tanstackStart()`. It auto-generates:
- PWA manifest from config (no separate `manifest.json` file needed)
- Service worker with Workbox precaching strategies
- Registration code with update prompts
- Ships comprehensive TypeScript types including React-specific types

**Service worker registration** (React hook):

```typescript
import { useRegisterSW } from 'virtual:pwa-register/react';

const {
  offlineReady: [offlineReady, setOfflineReady],
  needRefresh: [needRefresh, setNeedRefresh],
  updateServiceWorker,
} = useRegisterSW();
```

**TypeScript setup**: Add `"vite-plugin-pwa/react"` to `tsconfig.json`
`compilerOptions.types` for virtual module types.

**Caching strategy**: Precache all app shell assets (HTML, JS, CSS, fonts).
No runtime caching needed since all data is in IndexedDB (not fetched via
network). Use `registerType: 'prompt'` to avoid losing unsaved form data
on auto-update.

**Alternatives considered**:
- Manual service worker: More control but significantly more boilerplate.
  Workbox handles cache versioning and update flows.
- `@vite-pwa/assets-generator`: Add-on for icon generation from a single
  source SVG — recommended for generating the required PWA icon sizes.
