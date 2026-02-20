import { test, expect } from "@playwright/test";

test.describe("vault setup and unlock", () => {
  test("first visit redirects to setup page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/setup/);
    await expect(page.getByText("Create Your Vault")).toBeVisible();
  });

  test("creates vault with passphrase and redirects to timeline", async ({
    page,
  }) => {
    await page.goto("/setup");

    await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
    await page.getByLabel("Confirm Passphrase").fill("test-passphrase-123");
    await page.getByRole("button", { name: /create vault/i }).click();

    await expect(page).toHaveURL(/timeline/);
  });

  test("rejects passphrase under 8 characters", async ({ page }) => {
    await page.goto("/setup");

    await page.getByLabel("Passphrase", { exact: true }).fill("short");
    await page.getByLabel("Confirm Passphrase").fill("short");

    await expect(page.getByRole("button", { name: /create vault/i })).toBeDisabled();
    await expect(page).toHaveURL(/setup/);
  });

  test("rejects mismatched passphrases", async ({ page }) => {
    await page.goto("/setup");

    await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
    await page.getByLabel("Confirm Passphrase").fill("different-passphrase");

    await expect(page.getByRole("button", { name: /create vault/i })).toBeDisabled();
    await expect(page).toHaveURL(/setup/);
  });

  test("shows error for wrong passphrase on unlock", async ({ page }) => {
    // Setup first
    await page.goto("/setup");
    await page.getByLabel("Passphrase", { exact: true }).fill("correct-pass-123");
    await page.getByLabel("Confirm Passphrase").fill("correct-pass-123");
    await page.getByRole("button", { name: /create vault/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Navigate to unlock (simulate lock)
    await page.goto("/unlock");
    await page.getByLabel("Passphrase", { exact: true }).fill("wrong-passphrase");
    await page.getByRole("button", { name: /unlock/i }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test("unlocks vault with correct passphrase", async ({ page }) => {
    // Setup
    await page.goto("/setup");
    await page.getByLabel("Passphrase", { exact: true }).fill("correct-pass-123");
    await page.getByLabel("Confirm Passphrase").fill("correct-pass-123");
    await page.getByRole("button", { name: /create vault/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Lock and unlock
    await page.goto("/unlock");
    await page.getByLabel("Passphrase", { exact: true }).fill("correct-pass-123");
    await page.getByRole("button", { name: /unlock/i }).click();

    await expect(page).toHaveURL(/timeline/);
  });
});
