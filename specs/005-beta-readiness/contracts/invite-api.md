# API Contract: Invite System

**Base path**: `/api/v1`

## POST /invites/verify

Verify that an email address has a valid, unconsumed invite. Called by the client after Auth0 login to gate access.

**Authentication**: Required (Auth0 JWT)

**Request body**:
```json
{
  "email": "user@example.com"
}
```

**Response 200** (invite valid):
```json
{
  "status": "valid",
  "email": "user@example.com"
}
```

**Response 403** (no valid invite):
```json
{
  "error": "invite_required",
  "message": "A valid invite is required to access Reflog during the beta."
}
```

**Response 403** (beta at capacity):
```json
{
  "error": "beta_full",
  "message": "The beta is currently at capacity. You have been added to the waitlist."
}
```

---

## POST /invites/consume

Mark an invite as consumed after successful account setup. Called once during the first-login flow.

**Authentication**: Required (Auth0 JWT)

**Request body**:
```json
{
  "email": "user@example.com"
}
```

**Response 200**:
```json
{
  "status": "consumed",
  "email": "user@example.com"
}
```

**Response 409** (already consumed):
```json
{
  "error": "already_consumed",
  "message": "This invite has already been used."
}
```

---

## POST /waitlist

Add an email to the waitlist. Public endpoint (no auth required).

**Rate limit**: 10 requests/minute per IP

**Request body**:
```json
{
  "email": "user@example.com",
  "consent": true
}
```

**Validation**:
- `email`: Required, valid email format
- `consent`: Required, must be `true`

**Response 201**:
```json
{
  "status": "added",
  "message": "You have been added to the waitlist."
}
```

**Response 409** (already on waitlist):
```json
{
  "status": "exists",
  "message": "This email is already on the waitlist."
}
```

**Response 400** (consent not given):
```json
{
  "error": "consent_required",
  "message": "You must consent to the privacy policy to join the waitlist."
}
```

---

## GET /beta/status

Return beta capacity information. Public endpoint (no auth required).

**Response 200**:
```json
{
  "accepting_signups": true,
  "waitlist_open": true
}
```

Note: Does not expose exact user counts or capacity numbers to prevent information leakage.

---

## CLI-Only Operations (not HTTP endpoints)

The following operations are performed by the operator CLI tool directly against D1 via Wrangler, not through the HTTP API:

- **Generate invite**: Insert into `invites` table + call Auth0 Management API
- **List invites**: Query `invites` table (filter by status)
- **Revoke invite**: Update `invites.status` to `revoked`
- **View waitlist**: Query `waitlist` table
- **Set beta config**: Update `beta_config` table
- **View beta stats**: Count users, invites, waitlist entries
