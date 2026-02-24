# Quickstart: CLI D1 REST API Migration

**Branch**: `006-cli-d1-rest-api` | **Date**: 2026-02-24

## Prerequisites

- Node.js 22.x
- A Cloudflare API Token with D1 read/write permissions
- Your Cloudflare Account ID (found in the Cloudflare dashboard URL)
- The D1 Database ID for your target environment (from `wrangler.toml` or `wrangler d1 list`)

## Setup

1. **Create a Cloudflare API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use the "Custom token" template
   - Add permission: Account → D1 → Edit
   - Create and copy the token

2. **Configure the CLI `.env` file**:

   ```bash
   cp packages/cli/.env.example packages/cli/.env
   ```

   Fill in:
   ```
   CLOUDFLARE_API_TOKEN=your-api-token
   CLOUDFLARE_ACCOUNT_ID=your-account-id
   D1_DATABASE_ID=0f8e68b4-13e4-4899-96b8-cb9cb4cefa91

   # Only needed for `invite create`:
   AUTH0_DOMAIN=reflog-microcode.us.auth0.com
   AUTH0_CLIENT_ID=your-m2m-client-id
   AUTH0_CLIENT_SECRET=your-m2m-client-secret
   ```

3. **Optionally create a preview `.env`**:

   ```bash
   cp packages/cli/.env packages/cli/.env.preview
   ```

   Change `D1_DATABASE_ID` to the preview database ID (`5911abf9-62ba-423c-82f5-9782af5cb31f`).

## Usage

```bash
# Default environment (loads packages/cli/.env)
yarn workspace @reflog/cli dev -- config get max_beta_users

# Preview environment
yarn workspace @reflog/cli dev -- --env packages/cli/.env.preview invite list

# All commands
yarn workspace @reflog/cli dev -- invite list
yarn workspace @reflog/cli dev -- invite list --status pending
yarn workspace @reflog/cli dev -- invite create someone@example.com
yarn workspace @reflog/cli dev -- invite create someone@example.com --from-waitlist
yarn workspace @reflog/cli dev -- invite revoke someone@example.com
yarn workspace @reflog/cli dev -- waitlist list
yarn workspace @reflog/cli dev -- config get max_beta_users
yarn workspace @reflog/cli dev -- config set max_beta_users 100
```

## Verification

Run these commands to verify the migration works:

1. `yarn workspace @reflog/cli dev -- config get max_beta_users` — should return the current value
2. `yarn workspace @reflog/cli dev -- invite list` — should list all invites
3. `yarn workspace @reflog/cli dev -- --env packages/cli/.env.preview config get max_beta_users` — should query the preview database
