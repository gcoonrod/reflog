# Auth0 Production Setup Guide

**Environment**: Production tenant
**Date**: 2026-02-23

## Prerequisites

- Auth0 account with production tenant access
- Admin permissions on the Auth0 Dashboard

## Step 1: Disable Public Signup

1. Navigate to **Authentication → Database → Username-Password-Authentication → Settings**
2. Scroll to **Disable Sign Ups**
3. Toggle **ON** (enabled)
4. Save Changes

This removes the signup button from Auth0 Universal Login. Users can only log in if their account already exists (created by the CLI tool via Management API).

## Step 2: Create Machine-to-Machine Application for CLI

1. Navigate to **Applications → Create Application**
2. Name: `reflog-cli`
3. Type: **Machine to Machine Applications**
4. Select the **Auth0 Management API** as the authorized API
5. Grant the following scopes:
   - `create:users` — Create user accounts from invite flow
   - `read:users` — Look up users by email during invite verification
   - `update:users` — Update user metadata if needed
6. Save

Record the following values from the application settings:
- **Domain**: `<tenant>.auth0.com`
- **Client ID**: `<m2m-client-id>`
- **Client Secret**: `<m2m-client-secret>`

## Step 3: Record API Audience

1. Navigate to **Applications → APIs**
2. Find the existing sync API audience: `sync.reflog.microcode.io`
3. Record this value for CLI configuration

## Step 4: Add Pre-User-Registration Action (Safety Net)

This Action denies any signup attempt that bypasses the disabled UI (e.g., direct API calls to Auth0).

1. Navigate to **Actions → Flows → Pre User Registration**
2. Click **Add Action → Build from Scratch**
3. Name: `deny-direct-signup`
4. Runtime: Node 22
5. Paste the following code:

```javascript
exports.onExecutePreUserRegistration = async (event, api) => {
  // Safety net: deny all direct signups.
  // User accounts should only be created via the CLI tool
  // using the Management API (bypasses this Action).
  api.access.deny("direct_signup_denied", "Signup is not available. Please request an invite.");
};
```

6. Click **Deploy**
7. Drag the Action into the Pre User Registration flow and click **Apply**

**Why this works**: The Management API's `POST /api/v2/users` endpoint does NOT trigger the Pre User Registration flow — it's a privileged administrative operation. Only the Authentication API's signup endpoint triggers this Action. So the CLI tool can still create users while direct signup attempts are blocked.

## Step 5: Verify Configuration

1. Visit `https://<tenant>.auth0.com/authorize?...` — confirm no signup option is visible
2. Attempt a direct signup via the Authentication API — confirm it is denied by the Action
3. Use the CLI tool to create a test user — confirm account is created successfully

## Environment Variables for CLI

Add these to `packages/cli/.env`:

```
AUTH0_DOMAIN=<tenant>.auth0.com
AUTH0_CLIENT_ID=<m2m-client-id>
AUTH0_CLIENT_SECRET=<m2m-client-secret>
AUTH0_AUDIENCE=sync.reflog.microcode.io
D1_DATABASE_ID=<from wrangler d1 list>
```
