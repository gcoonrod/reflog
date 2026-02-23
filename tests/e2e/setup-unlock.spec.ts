import { test, expect, type Page } from "@playwright/test";

// Mantine v8 PasswordInput wraps the <input> in nested divs.
// getByLabel() may resolve to a wrapper element, so fill() and
// pressSequentially() don't reach the actual <input>.
// The reliable pattern: click the label-associated element (which
// focuses the real <input>), then use keyboard.type() to send
// keystrokes to the focused element.
async function typeIntoPasswordInput(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: label === "Passphrase" }).click();
  await page.keyboard.type(value);
}

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

    await typeIntoPasswordInput(page, "Passphrase", "test-passphrase-123");
    await typeIntoPasswordInput(page, "Confirm Passphrase", "test-passphrase-123");
    await page.getByRole("button", { name: /create vault/i }).click();

    await expect(page).toHaveURL(/timeline/);
  });

  test("rejects passphrase under 8 characters", async ({ page }) => {
    await page.goto("/setup");

    await typeIntoPasswordInput(page, "Passphrase", "short");
    await typeIntoPasswordInput(page, "Confirm Passphrase", "short");

    await expect(page.getByRole("button", { name: /create vault/i })).toBeDisabled();
    await expect(page).toHaveURL(/setup/);
  });

  test("rejects mismatched passphrases", async ({ page }) => {
    await page.goto("/setup");

    await typeIntoPasswordInput(page, "Passphrase", "test-passphrase-123");
    await typeIntoPasswordInput(page, "Confirm Passphrase", "different-passphrase");

    await expect(page.getByRole("button", { name: /create vault/i })).toBeDisabled();
    await expect(page).toHaveURL(/setup/);
  });

  test("shows error for wrong passphrase on unlock", async ({ page }) => {
    // Setup first
    await page.goto("/setup");
    await typeIntoPasswordInput(page, "Passphrase", "correct-pass-123");
    await typeIntoPasswordInput(page, "Confirm Passphrase", "correct-pass-123");
    await page.getByRole("button", { name: /create vault/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Navigate to unlock (simulate lock)
    await page.goto("/unlock");
    await typeIntoPasswordInput(page, "Passphrase", "wrong-passphrase");
    await page.getByRole("button", { name: /unlock/i }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test("unlocks vault with correct passphrase", async ({ page }) => {
    // Setup
    await page.goto("/setup");
    await typeIntoPasswordInput(page, "Passphrase", "correct-pass-123");
    await typeIntoPasswordInput(page, "Confirm Passphrase", "correct-pass-123");
    await page.getByRole("button", { name: /create vault/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Lock and unlock
    await page.goto("/unlock");
    await typeIntoPasswordInput(page, "Passphrase", "correct-pass-123");
    await page.getByRole("button", { name: /unlock/i }).click();

    await expect(page).toHaveURL(/timeline/);
  });
});
