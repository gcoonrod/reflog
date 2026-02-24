import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { query, type D1Options } from "../lib/d1.js";

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
    const d1Opts = getD1Options(configCommand);

    const result = await query<{ key: string; value: string; updated_at: string }>(
      `SELECT * FROM beta_config WHERE key = '${key}'`,
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
    const d1Opts = getD1Options(configCommand);

    await query(
      `INSERT INTO beta_config (key, value, updated_at)
       VALUES ('${key}', '${value}', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = '${value}', updated_at = datetime('now')`,
      d1Opts
    );

    console.log(`Set ${key} = ${value}`);
  });
