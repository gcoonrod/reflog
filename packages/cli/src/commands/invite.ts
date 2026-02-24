import { Command } from "commander";
import { randomUUID, randomBytes } from "crypto";
import { loadCoreConfig, loadAuth0Config } from "../lib/config.js";
import { createUser, triggerPasswordReset } from "../lib/auth0.js";
import { query } from "../lib/d1.js";

export const inviteCommand = new Command("invite").description(
  "Manage beta invites"
);

inviteCommand
  .command("create <email>")
  .option("--from-waitlist", "Mark waitlist entry as invited")
  .description("Create a new invite and Auth0 account for an email")
  .action(async (email: string, opts: { fromWaitlist?: boolean }) => {
    const envPath = inviteCommand.parent?.opts().env as string | undefined;
    const config = loadCoreConfig(envPath);
    const auth0Config = loadAuth0Config(envPath);

    // Check for existing invite
    const existing = await query(
      "SELECT id, status FROM invites WHERE email = ?",
      [email],
      config
    );
    if (existing.results.length > 0) {
      const invite = existing.results[0] as { id: string; status: string };
      console.error(
        `Invite already exists for ${email} (status: ${invite.status})`
      );
      process.exit(1);
    }

    // Get expiry days from config
    const expiryResult = await query<{ value: string }>(
      "SELECT value FROM beta_config WHERE key = ?",
      ["invite_expiry_days"],
      config
    );
    const expiryDays = expiryResult.results[0]?.value ?? "30";

    console.log(`Creating Auth0 account for ${email}...`);
    const { userId: auth0UserId, created } = await createUser(auth0Config, email);
    if (created) {
      console.log("Triggering password reset email...");
      await triggerPasswordReset(auth0Config, email);
    } else {
      console.log(`Auth0 account already exists for ${email}, skipping creation.`);
    }

    const inviteId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000
    ).toISOString();

    await query(
      "INSERT INTO invites (id, email, token, status, created_by, created_at, expires_at) VALUES (?, ?, ?, 'pending', 'cli', ?, ?)",
      [inviteId, email, token, now, expiresAt],
      config
    );

    if (opts.fromWaitlist) {
      await query(
        "UPDATE waitlist SET invited = 1 WHERE email = ?",
        [email],
        config
      );
      console.log(`Waitlist entry for ${email} marked as invited.`);
    }

    console.log(`Invite created for ${email}`);
    console.log(`  Auth0 User ID: ${auth0UserId}`);
    console.log(`  Invite ID: ${inviteId}`);
    console.log(`  Expires: ${expiresAt}`);
  });

inviteCommand
  .command("list")
  .option(
    "--status <status>",
    "Filter by status (pending, consumed, expired, revoked)"
  )
  .description("List all invites")
  .action(async (opts: { status?: string }) => {
    const envPath = inviteCommand.parent?.opts().env as string | undefined;
    const config = loadCoreConfig(envPath);
    const now = new Date().toISOString();

    const validStatuses = ["pending", "consumed", "expired", "revoked"];

    let sql: string;
    let params: string[];
    if (opts.status) {
      if (!validStatuses.includes(opts.status)) {
        console.error(
          `Invalid status: ${opts.status}. Must be one of: ${validStatuses.join(", ")}`
        );
        process.exit(1);
      }
      sql = "SELECT * FROM invites WHERE status = ? ORDER BY created_at DESC";
      params = [opts.status];
    } else {
      sql = "SELECT * FROM invites ORDER BY created_at DESC";
      params = [];
    }

    const result = await query<{
      email: string;
      status: string;
      created_at: string;
      expires_at: string;
      consumed_at: string | null;
    }>(sql, params, config);

    if (result.results.length === 0) {
      console.log("No invites found.");
      return;
    }

    console.log(
      "Email".padEnd(35) +
        "Status".padEnd(12) +
        "Created".padEnd(22) +
        "Expires"
    );
    console.log("-".repeat(90));

    for (const invite of result.results) {
      // FR-005: Annotate pending invites past expires_at as expired (lazy expiration)
      let displayStatus = invite.status;
      if (invite.status === "pending" && invite.expires_at < now) {
        displayStatus = "expired*";
      }
      console.log(
        invite.email.padEnd(35) +
          displayStatus.padEnd(12) +
          invite.created_at.substring(0, 19).padEnd(22) +
          invite.expires_at.substring(0, 19)
      );
    }

    if (result.results.some((i) => i.status === "pending" && i.expires_at < now)) {
      console.log("\n* Pending invites past expiration date (not yet consumed)");
    }
  });

inviteCommand
  .command("revoke <email>")
  .description("Revoke a pending invite")
  .action(async (email: string) => {
    const envPath = inviteCommand.parent?.opts().env as string | undefined;
    const config = loadCoreConfig(envPath);

    const result = await query(
      "UPDATE invites SET status = 'revoked' WHERE email = ? AND status = 'pending'",
      [email],
      config
    );

    if (result.meta.changes === 0) {
      console.error(
        `No pending invite found for ${email} (may be already consumed or revoked).`
      );
      process.exit(1);
    }

    console.log(`Invite revoked for ${email}.`);
  });
