#!/usr/bin/env node
import { Command } from "commander";
import { inviteCommand } from "./commands/invite.js";
import { waitlistCommand } from "./commands/waitlist.js";
import { configCommand } from "./commands/config.js";

const program = new Command();

program
  .name("reflog-cli")
  .description("Reflog operator CLI tool")
  .version("0.1.0")
  .option("--env <environment>", "Target environment for D1 (e.g., preview)");

program.addCommand(inviteCommand);
program.addCommand(waitlistCommand);
program.addCommand(configCommand);

program.parse();
