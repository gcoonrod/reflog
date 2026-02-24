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

export const waitlistCommand = new Command("waitlist").description(
  "Manage the beta waitlist"
);

waitlistCommand
  .command("list")
  .description("List all waitlist entries")
  .action(async () => {
    const d1Opts = getD1Options(waitlistCommand);

    const result = await query<{
      email: string;
      created_at: string;
      invited: number;
    }>("SELECT * FROM waitlist ORDER BY created_at ASC", d1Opts);

    if (result.results.length === 0) {
      console.log("No waitlist entries.");
      return;
    }

    console.log(
      "Email".padEnd(35) + "Signed Up".padEnd(22) + "Invited"
    );
    console.log("-".repeat(65));

    for (const entry of result.results) {
      console.log(
        entry.email.padEnd(35) +
          entry.created_at.substring(0, 19).padEnd(22) +
          (entry.invited ? "Yes" : "No")
      );
    }

    console.log(`\nTotal: ${result.results.length}`);
  });
