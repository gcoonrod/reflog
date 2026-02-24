# Contract: Cloudflare D1 REST API

**Used by**: `packages/cli/src/lib/d1.ts`

## Endpoint

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query
```

## Authentication

```
Authorization: Bearer {CLOUDFLARE_API_TOKEN}
Content-Type: application/json
```

## Request

```json
{
  "sql": "SELECT * FROM invites WHERE email = ?",
  "params": ["user@example.com"]
}
```

## Response (success)

```json
[
  {
    "results": [
      { "email": "user@example.com", "status": "pending", "expires_at": "2026-03-26T00:00:00.000Z" }
    ],
    "success": true,
    "meta": {
      "changes": 0,
      "duration": 0.42,
      "rows_read": 1,
      "rows_written": 0
    }
  }
]
```

## Response (SQL error)

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

## Response (HTTP 4xx/5xx — Cloudflare API Envelope)

Non-200 responses use a **different shape** — a Cloudflare API envelope object (not an array). The `d1.ts` parser must check the HTTP status code first and branch accordingly.

```json
{
  "success": false,
  "errors": [{ "code": 10000, "message": "Authentication error" }],
  "messages": [],
  "result": null
}
```

**Important**: HTTP 200 returns a **raw array** `[{...}]`. HTTP 4xx/5xx returns an **object** `{...}`. See `data-model.md` "D1 Response Shapes" for the full parsing strategy.

## CLI Query Interface

The `query()` function wraps this API. Its signature changes from:

**Before** (wrangler subprocess):
```typescript
query<T>(sql: string, options: D1Options): Promise<D1Result<T>>
// D1Options = { databaseId: string; env?: string }
```

**After** (REST API):
```typescript
query<T>(sql: string, params: QueryParam[], config: CoreConfig): Promise<D1Result<T>>
// QueryParam = string | number | boolean | null
```

Key changes:
1. `params` array replaces string interpolation — all user values passed as bind parameters
2. `CoreConfig` replaces `D1Options` — contains `cloudflareApiToken`, `cloudflareAccountId`, `d1DatabaseId`
3. No `env` field — environment is determined by which `.env` file is loaded
