# Data Model: CLI D1 REST API Migration

**Branch**: `006-cli-d1-rest-api` | **Date**: 2026-02-24

## Overview

This feature does not introduce new database entities. The CLI reads and writes the same D1 tables as before — it only changes *how* it communicates with D1 (REST API instead of wrangler subprocess). The data model below documents the configuration and request/response shapes that the new `d1.ts` module operates on.

## Configuration

### CoreConfig

Variables required by all CLI commands.

| Field | Source | Required |
|---|---|---|
| `cloudflareApiToken` | `CLOUDFLARE_API_TOKEN` env var | Yes |
| `cloudflareAccountId` | `CLOUDFLARE_ACCOUNT_ID` env var | Yes |
| `d1DatabaseId` | `D1_DATABASE_ID` env var | Yes |

### Auth0Config

Variables required only by `invite create`.

| Field | Source | Required |
|---|---|---|
| `auth0Domain` | `AUTH0_DOMAIN` env var | Only for `invite create` |
| `auth0ClientId` | `AUTH0_CLIENT_ID` env var | Only for `invite create` |
| `auth0ClientSecret` | `AUTH0_CLIENT_SECRET` env var | Only for `invite create` |

### Config Loading

1. If `--env <path>` is provided, load the `.env` file at that path.
2. Otherwise, load the default `.env` file from the CLI package directory (`packages/cli/.env`).
3. Validate `CoreConfig` variables immediately after loading.
4. Validate `Auth0Config` variables only when `invite create` is invoked.

## D1 REST API Request

### D1QueryRequest

Sent to `POST /accounts/{account_id}/d1/database/{database_id}/query`.

| Field | Type | Description |
|---|---|---|
| `sql` | `string` | SQL statement with `?` parameter placeholders |
| `params` | `(string \| number \| boolean \| null)[]` | Ordered parameter values bound to `?` placeholders |

### D1 Response Shapes

The D1 REST API returns **two different shapes** depending on whether the HTTP request itself succeeded:

#### Shape 1: HTTP 200 — Raw Array (success or SQL error)

When the HTTP request reaches D1, the response body is a **raw JSON array** of result sets (one per SQL statement). This applies to both successful queries and SQL-level errors.

```json
[
  {
    "results": [{ "email": "user@example.com", "status": "pending" }],
    "success": true,
    "meta": { "changes": 0, "duration": 0.42, "rows_read": 1, "rows_written": 0 }
  }
]
```

On SQL error (still HTTP 200):
```json
[
  {
    "results": [],
    "success": false,
    "meta": { "changes": 0, "duration": 0 },
    "error": "no such table: invites"
  }
]
```

Note: The error field is **singular** `error` (a string) on individual result sets.

#### Shape 2: HTTP 4xx/5xx — Cloudflare API Envelope (auth/infra errors)

When the request fails before reaching D1 (auth, permissions, bad IDs), the response is a Cloudflare API **envelope object** (not an array).

```json
{
  "success": false,
  "errors": [{ "code": 10000, "message": "Authentication error" }],
  "messages": [],
  "result": null
}
```

Note: The errors field is **plural** `errors` (an array of objects with `code` and `message`).

#### Parsing Strategy

The `d1.ts` `query()` function must:
1. Check the HTTP status code first — 4xx/5xx means envelope format, handle the error
2. On HTTP 200, parse the body as an array, take index `[0]`, check `success`
3. If `success: false`, read the `error` string from the result set

### D1ResultSet

Each element of the HTTP 200 response array.

| Field | Type | Description |
|---|---|---|
| `results` | `Record<string, unknown>[]` | Row objects |
| `success` | `boolean` | Whether this statement succeeded |
| `meta` | `D1Meta` | Execution metadata |
| `error` | `string \| undefined` | SQL error message (only present when `success` is false) |

### D1Meta

| Field | Type | Description |
|---|---|---|
| `changes` | `number` | Rows modified by INSERT/UPDATE/DELETE |
| `duration` | `number` | Execution time in milliseconds |
| `rows_read` | `number` | Rows scanned |
| `rows_written` | `number` | Rows written |

## Existing D1 Tables (unchanged)

The CLI queries these tables but does not modify their schemas:

- **invites** — Beta invite records (id, email, token, status, created_by, created_at, expires_at, consumed_at, consumed_by_user_id)
- **waitlist** — Waitlist signups (id, email, created_at, consent, invited)
- **beta_config** — Key-value configuration (key, value, updated_at)
