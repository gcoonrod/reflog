import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from packages/cli/
config({ path: resolve(__dirname, "../../.env") });

export interface CliConfig {
  auth0Domain: string;
  auth0ClientId: string;
  auth0ClientSecret: string;
  auth0Audience: string;
  d1DatabaseId: string;
}

export function loadConfig(): CliConfig {
  const required = [
    "AUTH0_DOMAIN",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
    "AUTH0_AUDIENCE",
    "D1_DATABASE_ID",
  ] as const;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Copy packages/cli/.env.example to packages/cli/.env and fill in values.`
    );
  }

  return {
    auth0Domain: process.env.AUTH0_DOMAIN!,
    auth0ClientId: process.env.AUTH0_CLIENT_ID!,
    auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET!,
    auth0Audience: process.env.AUTH0_AUDIENCE!,
    d1DatabaseId: process.env.D1_DATABASE_ID!,
  };
}
