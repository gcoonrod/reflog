import { ManagementClient } from "auth0";
import type { CliConfig } from "./config.js";

let managementClient: ManagementClient | null = null;

export function getManagementClient(config: CliConfig): ManagementClient {
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
  config: CliConfig,
  email: string
): Promise<string> {
  const client = getManagementClient(config);
  const response = await client.users.create({
    email,
    connection: "Username-Password-Authentication",
    // Random password — user will set their own via password reset email
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_verified: true,
  });
  return response.data.user_id!;
}

export async function triggerPasswordReset(
  config: CliConfig,
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
