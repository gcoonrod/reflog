# Auth0 Preview (Dev) Tenant Setup Guide

**Environment**: `reflog-dev` tenant (Development tag)
**Date**: 2026-02-23

## Purpose

Separate Auth0 tenant for preview and local development. Isolates dev/preview users from production. Prevents preview callback URLs (wildcard patterns) from affecting the production tenant.

## Step 1: Create Dev Tenant

1. Go to Auth0 Dashboard → Tenant Settings → Create Tenant
2. Name: `reflog-dev`
3. Environment tag: **Development**

## Step 2: Configure Application

1. Navigate to **Applications → Create Application**
2. Name: `reflog-web-dev`
3. Type: **Single Page Application**
4. Settings:
   - **Allowed Callback URLs**: `http://localhost:3000, https://develop.reflog.pages.dev`
   - **Allowed Logout URLs**: `http://localhost:3000/login, https://develop.reflog.pages.dev/login`
   - **Allowed Web Origins**: `http://localhost:3000, https://develop.reflog.pages.dev`

Record:
- **Domain**: `reflog-dev.us.auth0.com`
- **Client ID**: `<dev-spa-client-id>`

## Step 3: Create API

1. Navigate to **Applications → APIs → Create API**
2. Name: `reflog-sync-preview`
3. Identifier (audience): `https://sync-preview.reflog.microcode.io`
4. Signing Algorithm: RS256

## Step 4: Disable Signup

1. Navigate to **Authentication → Database → Username-Password-Authentication → Settings**
2. Toggle **Disable Sign Ups** ON
3. Save

## Step 5: Create M2M Application for CLI

1. **Applications → Create Application**
2. Name: `reflog-cli-dev`
3. Type: **Machine to Machine Applications**
4. Authorize against **Auth0 Management API**
5. Grant scopes: `create:users`, `read:users`, `update:users`

Record:
- **Client ID**: `<dev-m2m-client-id>`
- **Client Secret**: `<dev-m2m-client-secret>`

## Step 6: Add Safety Net Action

Same pre-user-registration Action as production (see `auth0-production-setup.md` Step 4).

## Configuration Comparison

| Setting | Dev Tenant | Production Tenant |
|---------|-----------|-------------------|
| Domain | `reflog-dev.us.auth0.com` | `reflog-microcode.us.auth0.com` |
| SPA Client | `reflog-web-dev` | `reflog-web` |
| Callback URLs | `localhost:3000`, `develop.reflog.pages.dev` | `reflog.microcode.io` |
| API Audience | `sync-preview.reflog.microcode.io` | `sync.reflog.microcode.io` |
| Signup | Disabled | Disabled |
| M2M App | `reflog-cli-dev` | `reflog-cli` |

## GitHub Secrets for Preview

Add to repository settings:
- `VITE_AUTH0_DOMAIN_PREVIEW`: `reflog-dev.us.auth0.com`
- `VITE_AUTH0_CLIENT_ID_PREVIEW`: `<dev-spa-client-id>`
- `VITE_AUTH0_AUDIENCE_PREVIEW`: `https://sync-preview.reflog.microcode.io`
- `VITE_SYNC_API_URL_PREVIEW`: `https://reflog-sync-api-preview.greg-coonrod.workers.dev`
