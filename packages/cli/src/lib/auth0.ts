import { ManagementClient } from "auth0";
import type { Auth0Config } from "./config.js";

let managementClient: ManagementClient | null = null;

export function getManagementClient(config: Auth0Config): ManagementClient {
  if (!managementClient) {
    managementClient = new ManagementClient({
      domain: config.auth0Domain,
      clientId: config.auth0ClientId,
      clientSecret: config.auth0ClientSecret,
    });
  }
  return managementClient;
}

export async function createUser(
  config: Auth0Config,
  email: string
): Promise<{ userId: string; created: boolean }> {
  const client = getManagementClient(config);
  try {
    const response = await client.users.create({
      email,
      connection: "Username-Password-Authentication",
      // Random password — user will set their own via password reset email
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_verified: true,
    });
    return { userId: response.data.user_id!, created: true };
  } catch (err: unknown) {
    // Auth0 returns HTTP 409 when the user already exists
    if (err !== null && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 409) {
      const existing = await client.usersByEmail.getByEmail({ email });
      const user = existing.data[0];
      if (!user) {
        throw new Error(`Auth0 reports user exists for ${email} but lookup returned no results.`);
      }
      return { userId: user.user_id!, created: false };
    }
    throw err;
  }
}

export async function triggerPasswordReset(
  config: Auth0Config,
  email: string
): Promise<void> {
  // The password reset endpoint is on the Authentication API, not Management API.
  // Use a direct HTTP call to the /dbconnections/change_password endpoint.
  const response = await fetch(
    `https://${config.auth0Domain}/dbconnections/change_password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.auth0ClientId,
        email,
        connection: "Username-Password-Authentication",
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to trigger password reset: ${response.status} ${body}`);
  }
}
