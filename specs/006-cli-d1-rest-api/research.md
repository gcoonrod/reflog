# Research: CLI D1 REST API Migration

**Branch**: `006-cli-d1-rest-api` | **Date**: 2026-02-24

## R1: Cloudflare D1 REST API Query Endpoint

**Decision**: Use the documented D1 query endpoint with parameterized SQL.

**Endpoint**: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query`

**Request body**:
```json
{
  "sql": "SELECT * FROM invites WHERE email = ?",
  "params": ["user@example.com"]
}
```

**Response format**:
```json
[{
  "results": [{ "email": "user@example.com", "status": "pending" }],
  "success": true,
  "meta": {
    "changes": 0,
    "duration": 0.5,
    "rows_read": 1,
    "rows_written": 0
  }
}]
```

Note: The response is an **array** of result sets (one per statement). For single-statement queries, use index `[0]`.

**Authentication**: Bearer token via `Authorization: Bearer <token>` header.

**Required token permissions**: At least one of D1 Read or D1 Write (both needed for the CLI).

**Rationale**: This is the only supported programmatic interface for D1 outside of wrangler and Workers bindings. It supports parameterized queries natively, eliminating the need for manual SQL escaping.

**Alternatives considered**:
- `wrangler d1 execute` subprocess (current approach) — rejected due to wrangler dependency, fragile stderr parsing, subprocess overhead.
- Cloudflare Workers binding from within a Worker — not applicable since the CLI runs on the operator's machine, not in a Worker.

## R2: Authentication — API Token vs OAuth

**Decision**: Use a Cloudflare API Token (static bearer token).

**Rationale**: API Tokens are the standard auth method for Cloudflare's REST API from CLI tools. They are scoped to specific permissions (D1 read/write) and can be rotated independently. The alternative — Cloudflare's global API key — is overly permissive and deprecated for new integrations.

**Alternatives considered**:
- Global API key (`X-Auth-Key` + `X-Auth-Email` headers) — rejected due to overly broad permissions and Cloudflare's own recommendation against it.
- OAuth2 flow — rejected as overkill for a single-operator CLI tool.

## R3: Removing wrangler as a Dependency

**Decision**: Remove `wrangler` from the CLI package's dependencies entirely. The `d1.ts` module will use native `fetch` instead of `execFile("npx", ["wrangler", ...])`.

**Rationale**: The CLI only uses wrangler for `d1 execute --remote --json`. Replacing this single call with a direct HTTP request removes ~150MB of transitive dependencies and eliminates the need for `wrangler login`.

**Impact on package.json**:
- Remove: No wrangler dependency exists directly in CLI's package.json (it's in sync-api). No change needed.
- The `nohoist` config in root package.json is unaffected (it applies to sync-api's wrangler).

## R4: Lazy Config Validation Strategy

**Decision**: Split configuration loading into two tiers — core (Cloudflare) and extended (Auth0). Validate each tier only when needed.

**Core variables** (required by all commands): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`

**Extended variables** (required only by `invite create`): `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`

**Rationale**: Operators who only need to check config values or list waitlist entries shouldn't need Auth0 M2M credentials. The current `loadConfig()` function validates all variables upfront, which forces unnecessary setup for simple operations.

## R5: Error Handling Taxonomy

**Decision**: Map Cloudflare API responses to clear CLI error messages.

| HTTP Status | Meaning | CLI Message |
|---|---|---|
| 200 with `success: false` | SQL error | `D1 query error: <error message from response>` |
| 401 | Invalid/expired token | `Authentication failed (HTTP 401). Check your CLOUDFLARE_API_TOKEN.` |
| 403 | Insufficient permissions | `Access denied (HTTP 403). Ensure your API token has D1 read/write permissions.` |
| 404 | Invalid account/database ID | `Database not found (HTTP 404). Check CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_ID.` |
| 429 | Rate limited | `Rate limited by Cloudflare API. Try again in a few seconds.` |
| 5xx | Server error | `Cloudflare API error (HTTP <status>). Try again later.` |
| Network error | Unreachable | `Could not connect to Cloudflare API: <error message>` |

**Rationale**: The current wrangler-based approach mixes stderr diagnostics with real errors and requires fragile string matching (`stderr.includes("ERROR")`). Direct HTTP responses provide unambiguous status codes.

## R6: `--env` Flag — File Path Behavior

**Decision**: Repurpose `--env <path>` to accept a path to a `.env` file. Default: `packages/cli/.env` (same location as today, resolved relative to the CLI package root).

**Resolution behavior**:
- Absolute paths used as-is
- Relative paths resolved from the current working directory

**Rationale**: Operators maintain separate `.env` files per environment (e.g., `.env.production`, `.env.preview`) and switch between them with `--env ./path/to/file.env`. This is simpler than the previous wrangler-based `--env preview` which required understanding wrangler's environment system.
