import { Command } from "commander";
import { loadCoreConfig } from "../lib/config.js";
import { query } from "../lib/d1.js";

const VALID_CONFIG_KEYS = [
  "max_beta_users",
  "invite_expiry_days",
  "waitlist_enabled",
];

export const configCommand = new Command("config").description(
  "Manage beta configuration"
);

configCommand
  .command("get <key>")
  .description("Get a beta config value")
  .action(async (key: string) => {
    if (!VALID_CONFIG_KEYS.includes(key)) {
      console.error(
        `Invalid config key: ${key}. Must be one of: ${VALID_CONFIG_KEYS.join(", ")}`
      );
      process.exit(1);
    }
    const envPath = configCommand.parent?.opts().env as string | undefined;
    const config = loadCoreConfig(envPath);

    const result = await query<{ key: string; value: string; updated_at: string }>(
      "SELECT * FROM beta_config WHERE key = ?",
      [key],
      config
    );

    if (result.results.length === 0) {
      console.error(`Config key '${key}' not found.`);
      process.exit(1);
    }

    const row = result.results[0]!;
    console.log(`${row.key} = ${row.value} (updated: ${row.updated_at})`);
  });

configCommand
  .command("set <key> <value>")
  .description("Set a beta config value")
  .action(async (key: string, value: string) => {
    if (!VALID_CONFIG_KEYS.includes(key)) {
      console.error(
        `Invalid config key: ${key}. Must be one of: ${VALID_CONFIG_KEYS.join(", ")}`
      );
      process.exit(1);
    }
    const envPath = configCommand.parent?.opts().env as string | undefined;
    const config = loadCoreConfig(envPath);

    await query(
      "INSERT INTO beta_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')",
      [key, value, value],
      config
    );

    console.log(`Set ${key} = ${value}`);
  });
