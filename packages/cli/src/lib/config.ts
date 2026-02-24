import { config } from "dotenv";
import { resolve, dirname, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = resolve(__dirname, "../../.env");

export interface CoreConfig {
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  d1DatabaseId: string;
}

export interface Auth0Config {
  auth0Domain: string;
  auth0ClientId: string;
  auth0ClientSecret: string;
}

function resolveEnvPath(envPath?: string): string {
  if (!envPath) return DEFAULT_ENV_PATH;
  return isAbsolute(envPath) ? envPath : resolve(process.cwd(), envPath);
}

function loadEnvFile(envPath?: string): void {
  const resolved = resolveEnvPath(envPath);
  if (envPath && !existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  config({ path: resolved });
}

export function loadCoreConfig(envPath?: string): CoreConfig {
  loadEnvFile(envPath);

  const required = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "D1_DATABASE_ID",
  ] as const;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy packages/cli/.env.example to packages/cli/.env and fill in values."
    );
  }

  return {
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN!,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    d1DatabaseId: process.env.D1_DATABASE_ID!,
  };
}

export function loadAuth0Config(envPath?: string): Auth0Config {
  loadEnvFile(envPath);

  const required = [
    "AUTH0_DOMAIN",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
  ] as const;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy packages/cli/.env.example to packages/cli/.env and fill in values."
    );
  }

  return {
    auth0Domain: process.env.AUTH0_DOMAIN!,
    auth0ClientId: process.env.AUTH0_CLIENT_ID!,
    auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET!,
  };
}
