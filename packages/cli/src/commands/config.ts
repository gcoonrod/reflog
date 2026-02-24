import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { query, type D1Options } from "../lib/d1.js";

/** Escape a string for use in a SQLite literal by doubling single quotes. */
function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

const VALID_CONFIG_KEYS = [
  "max_beta_users",
  "invite_expiry_days",
  "waitlist_enabled",
];

function getD1Options(cmd: Command): D1Options {
  const config = loadConfig();
  const parent = cmd.parent;
  return {
    databaseId: config.d1DatabaseId,
    env: parent?.opts().env,
  };
}

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
    const d1Opts = getD1Options(configCommand);
    const safeKey = sqlEscape(key);

    const result = await query<{ key: string; value: string; updated_at: string }>(
      `SELECT * FROM beta_config WHERE key = '${safeKey}'`,
      d1Opts
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
    const d1Opts = getD1Options(configCommand);
    const safeKey = sqlEscape(key);
    const safeValue = sqlEscape(value);

    await query(
      `INSERT INTO beta_config (key, value, updated_at)
       VALUES ('${safeKey}', '${safeValue}', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = '${safeValue}', updated_at = datetime('now')`,
      d1Opts
    );

    console.log(`Set ${key} = ${value}`);
  });
