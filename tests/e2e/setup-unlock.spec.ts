import { test, expect } from "@playwright/test";

test.describe("vault setup and unlock", () => {
  test("first visit redirects to setup page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/setup/);
    await expect(page.getByText("Set Up Your Vault")).toBeVisible();
  });

  test("creates vault with passphrase and redirects to timeline", async ({
    page,
  }) => {
    await page.goto("/setup");

    await page.getByPlaceholder("Enter passphrase").fill("test-passphrase-123");
    await page.getByPlaceholder("Confirm passphrase").fill("test-passphrase-123");
    await page.getByRole("button", { name: /create vault/i }).click();

    await expect(page).toHaveURL(/timeline/);
  });

  test("rejects passphrase under 8 characters", async ({ page }) => {
    await page.goto("/setup");

    await page.getByPlaceholder("Enter passphrase").fill("short");
    await page.getByPlaceholder("Confirm passphrase").fill("short");
    await page.getByRole("button", { name: /create vault/i }).click();

    await expect(page).toHaveURL(/setup/);
  });

  test("rejects mismatched passphrases", async ({ page }) => {
    await page.goto("/setup");

    await page.getByPlaceholder("Enter passphrase").fill("test-passphrase-123");
    await page.getByPlaceholder("Confirm passphrase").fill("different-passphrase");
    await page.getByRole("button", { name: /create vault/i }).click();

    await expect(page).toHaveURL(/setup/);
  });

  test("shows error for wrong passphrase on unlock", async ({ page }) => {
    // Setup first
    await page.goto("/setup");
    await page.getByPlaceholder("Enter passphrase").fill("correct-pass-123");
    await page.getByPlaceholder("Confirm passphrase").fill("correct-pass-123");
    await page.getByRole("button", { name: /create vault/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Navigate to unlock (simulate lock)
    await page.goto("/unlock");
    await page.getByPlaceholder("Enter passphrase").fill("wrong-passphrase");
    await page.getByRole("button", { name: /unlock/i }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test("unlocks vault with correct passphrase", async ({ page }) => {
    // Setup
    await page.goto("/setup");
    await page.getByPlaceholder("Enter passphrase").fill("correct-pass-123");
    await page.getByPlaceholder("Confirm passphrase").fill("correct-pass-123");
    await page.getByRole("button", { name: /create vault/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Lock and unlock
    await page.goto("/unlock");
    await page.getByPlaceholder("Enter passphrase").fill("correct-pass-123");
    await page.getByRole("button", { name: /unlock/i }).click();

    await expect(page).toHaveURL(/timeline/);
  });
});
