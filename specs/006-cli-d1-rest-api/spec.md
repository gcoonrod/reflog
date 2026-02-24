# Feature Specification: CLI D1 REST API Migration

**Feature Branch**: `006-cli-d1-rest-api`
**Created**: 2026-02-24
**Status**: Draft
**Input**: User description: "I want to refactor the CLI to use the documented CloudFlare D1 REST API instead of shelling out to wrangler."

## Clarifications

### Session 2026-02-24

- Q: Should the `--env` flag be removed or repurposed? → A: Keep `--env` and repurpose it to accept a file path to a `.env` file to load configuration from.
- Q: Should Auth0 variables be required for all commands or only when needed? → A: Validate Auth0 variables lazily — only when a command actually uses Auth0 (e.g., `invite create`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator runs CLI commands without wrangler login (Priority: P1)

An operator uses the CLI to manage invites, the waitlist, and beta config. Today each command shells out to `npx wrangler d1 execute`, which requires a prior interactive `wrangler login` session. After this change, the CLI authenticates with a Cloudflare API token passed via environment variable and calls the D1 REST API directly. The operator no longer needs wrangler installed or authenticated.

**Why this priority**: This is the core value — removing the wrangler dependency eliminates the main usability and reliability pain point of the CLI.

**Independent Test**: Can be fully tested by running any existing CLI command (e.g., `reflog-cli config get max_beta_users`) with a valid API token and observing the same result as the wrangler-based version, without wrangler being logged in.

**Acceptance Scenarios**:

1. **Given** a valid Cloudflare API token and account ID in the CLI `.env` file, **When** the operator runs `reflog-cli config get max_beta_users`, **Then** the CLI returns the current value from D1 without invoking wrangler.
2. **Given** a valid Cloudflare API token, **When** the operator runs `reflog-cli invite list`, **Then** the CLI returns all invites by querying D1 over HTTPS.
3. **Given** wrangler is not installed on the system, **When** the operator runs any CLI command with a valid API token, **Then** the command succeeds (wrangler is not required).

---

### User Story 2 - Operator targets preview vs production environment (Priority: P2)

The operator can target different D1 databases (production vs preview) by maintaining separate `.env` files for each environment (e.g., `.env.production`, `.env.preview`). The `--env` flag accepts a file path to the desired `.env` file. When omitted, the CLI loads the default `.env` file from the CLI package directory.

**Why this priority**: Environment targeting is essential for testing invites in preview before issuing them in production.

**Independent Test**: Can be tested by creating two `.env` files with different `D1_DATABASE_ID` values and running the same command with `--env path/to/preview.env` vs the default.

**Acceptance Scenarios**:

1. **Given** no `--env` flag is provided, **When** the operator runs `reflog-cli invite list`, **Then** the CLI loads configuration from the default `.env` file in the CLI package directory.
2. **Given** the operator passes `--env ./envs/preview.env`, **When** the operator runs `reflog-cli invite list`, **Then** the CLI loads configuration from `./envs/preview.env` and queries the D1 database specified in that file.
3. **Given** the operator passes `--env` with a path that does not exist, **When** the operator runs any CLI command, **Then** the CLI exits with an error stating the file was not found.

---

### User Story 3 - Operator receives clear errors for authentication and connectivity failures (Priority: P3)

When the API token is missing, invalid, or expired, or when the D1 endpoint is unreachable, the CLI displays a clear, actionable error message instead of a subprocess crash trace or opaque wrangler stderr output.

**Why this priority**: Good error messages reduce debugging time. The current wrangler stderr parsing is fragile and produces confusing output on failure.

**Independent Test**: Can be tested by providing an invalid API token and confirming the CLI outputs a human-readable error with guidance.

**Acceptance Scenarios**:

1. **Given** `CLOUDFLARE_API_TOKEN` is missing from the environment, **When** the operator runs any CLI command, **Then** the CLI exits with an error naming the missing variable and referencing `.env.example`.
2. **Given** an invalid or expired API token, **When** the operator runs any CLI command, **Then** the CLI displays "Authentication failed" with the HTTP status and suggests checking the token.
3. **Given** the Cloudflare API is unreachable (network error), **When** the operator runs any CLI command, **Then** the CLI displays a connectivity error with the endpoint URL that failed.

---

### Edge Cases

- What happens when the D1 query returns a SQL error (e.g., table does not exist)? The CLI displays the SQL error message from the API response.
- What happens when the API returns a rate-limit response (HTTP 429)? The CLI displays a "rate limited" message and suggests retrying.
- What happens when the API returns an unexpected response format? The CLI displays a generic error with the raw response for debugging.
- What happens when the SQL query succeeds but returns zero results? Existing behavior is preserved (e.g., "No invites found.").
- What happens when the `--env` file path does not exist? The CLI exits with an error stating the file was not found at the given path.
- What happens when the `--env` file exists but is missing required variables? The CLI exits with an error listing the missing variables, same as for the default `.env` file.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST authenticate to the Cloudflare D1 REST API using a bearer token from the `CLOUDFLARE_API_TOKEN` environment variable.
- **FR-002**: The CLI MUST use the `CLOUDFLARE_ACCOUNT_ID` environment variable to construct the D1 API endpoint URL.
- **FR-003**: The CLI MUST use the `D1_DATABASE_ID` environment variable to identify the target database.
- **FR-004**: The CLI MUST use parameterized queries (the `params` array in the D1 REST API request body) instead of string interpolation for all user-supplied values.
- **FR-005**: The CLI MUST NOT depend on wrangler being installed or authenticated on the operator's machine.
- **FR-006**: The CLI MUST preserve the existing command interface — all commands (`invite create`, `invite list`, `invite revoke`, `waitlist list`, `config get`, `config set`) MUST accept the same arguments and produce the same output format.
- **FR-007**: The CLI MUST support a `--env <path>` global option that loads configuration from the specified `.env` file. When omitted, the CLI loads the default `.env` file from the CLI package directory.
- **FR-008**: The CLI MUST display clear, human-readable error messages for authentication failures, network errors, SQL errors, and missing configuration.
- **FR-009**: The CLI MUST exit with a clear error if the `--env` path does not exist or the file is missing required variables.
- **FR-010**: The CLI MUST validate Auth0 configuration variables (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`) only when running commands that require Auth0 access (i.e., `invite create`). Commands that only query D1 (e.g., `config get`, `waitlist list`, `invite list`) MUST NOT require Auth0 variables.

### Key Entities

- **CLI Configuration**: Environment variables loaded from a `.env` file (default or specified via `--env`). Core variables required by all commands: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`. Auth0 variables required only by `invite create`: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`.
- **D1 Query**: A SQL statement with optional parameters sent to the Cloudflare D1 REST API and returning a result set with rows, metadata (changes, duration), and a success flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing CLI commands produce identical output when run against the same D1 database via the REST API as they did via wrangler.
- **SC-002**: The CLI operates successfully on a machine where wrangler is not installed.
- **SC-003**: All SQL queries use parameterized bindings — no user-supplied values are interpolated into SQL strings.
- **SC-004**: Authentication and connectivity errors produce a single-line actionable message (no multi-line stack traces or subprocess stderr dumps).

## Assumptions

- The operator creates a Cloudflare API token with D1 read/write permissions via the Cloudflare dashboard. Token creation is outside the scope of this feature.
- The `AUTH0_AUDIENCE` environment variable is removed from the CLI config since it was only used to help configure wrangler environment selection. Auth0 M2M authentication does not use it.
- The existing `.env.example` will be updated to reflect the new variable names and remove obsolete ones.
