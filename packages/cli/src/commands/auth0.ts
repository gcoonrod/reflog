import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { loadAuth0Config } from "../lib/config.js";
import { getManagementClient } from "../lib/auth0.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Works from both src/commands/ (dev via tsx) and dist/src/commands/ (built via tsc)
const PACKAGE_ROOT = existsSync(resolve(__dirname, "../../package.json"))
  ? resolve(__dirname, "../..")
  : resolve(__dirname, "../../..");

const ACTION_NAME = "reflog-add-email-to-access-token";
const TRIGGER_ID = "post-login";

export const auth0Command = new Command("auth0").description(
  "Manage Auth0 tenant configuration"
);

auth0Command
  .command("deploy-actions")
  .description(
    "Deploy Auth0 Actions from repo source (post-login email claim)"
  )
  .action(async () => {
    const envPath = auth0Command.parent?.opts().env as string | undefined;
    const auth0Config = loadAuth0Config(envPath);
    const client = getManagementClient(auth0Config);

    // 1. Read action source
    const codePath = resolve(
      PACKAGE_ROOT,
      "src/auth0-actions/post-login-add-email.js"
    );
    if (!existsSync(codePath)) {
      throw new Error(
        `Auth0 Action source file not found at ${codePath}. ` +
          "Ensure you are running from a checkout that includes " +
          "src/auth0-actions/post-login-add-email.js."
      );
    }
    const code = readFileSync(codePath, "utf-8");

    // 2. Find or create the action
    const existing = await client.actions.getAll({
      actionName: ACTION_NAME,
      triggerId: TRIGGER_ID,
    });

    let actionId: string;

    if (existing.data.actions.length > 0) {
      actionId = existing.data.actions[0]!.id;
      console.log(`Updating existing action ${ACTION_NAME} (${actionId})...`);
      await client.actions.update({ id: actionId }, { code });
    } else {
      console.log(`Creating action ${ACTION_NAME}...`);
      const created = await client.actions.create({
        name: ACTION_NAME,
        supported_triggers: [{ id: "post-login", version: "v3" }],
        code,
      });
      actionId = created.data.id;
    }

    // 3. Deploy
    console.log("Deploying action...");
    await client.actions.deploy({ id: actionId });

    // 4. Bind to post-login trigger (if not already bound)
    const bindings = await client.actions.getTriggerBindings({
      triggerId: TRIGGER_ID,
    });

    const alreadyBound = bindings.data.bindings.some(
      (b) => b.action.id === actionId
    );

    if (alreadyBound) {
      console.log("Action is already bound to the post-login trigger.");
    } else {
      console.log("Binding action to post-login trigger...");
      const existingRefs = bindings.data.bindings.map((b) => ({
        ref: { type: "action_id" as const, value: b.action.id },
        display_name: b.display_name,
      }));
      await client.actions.updateTriggerBindings(
        { triggerId: TRIGGER_ID },
        {
          bindings: [
            ...existingRefs,
            {
              ref: { type: "action_id" as const, value: actionId },
              display_name: ACTION_NAME,
            },
          ],
        }
      );
      console.log("Action bound to post-login trigger.");
    }

    console.log("Done.");
  });
