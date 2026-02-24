import { Command } from "commander";
import { loadCoreConfig } from "../lib/config.js";
import { query } from "../lib/d1.js";

export const waitlistCommand = new Command("waitlist").description(
  "Manage the beta waitlist"
);

waitlistCommand
  .command("list")
  .description("List all waitlist entries")
  .action(async () => {
    const envPath = waitlistCommand.parent?.opts().env as string | undefined;
    const config = loadCoreConfig(envPath);

    const result = await query<{
      email: string;
      created_at: string;
      invited: number;
    }>("SELECT * FROM waitlist ORDER BY created_at ASC", [], config);

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
