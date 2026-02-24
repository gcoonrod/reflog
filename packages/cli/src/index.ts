#!/usr/bin/env node
import { Command } from "commander";
import { inviteCommand } from "./commands/invite.js";
import { waitlistCommand } from "./commands/waitlist.js";
import { configCommand } from "./commands/config.js";
import { auth0Command } from "./commands/auth0.js";

const program = new Command();

program
  .name("reflog-cli")
  .description("Reflog operator CLI tool")
  .version("0.1.0")
  .option("--env <path>", "Path to .env file (default: packages/cli/.env)");

program.addCommand(inviteCommand);
program.addCommand(waitlistCommand);
program.addCommand(configCommand);
program.addCommand(auth0Command);

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
