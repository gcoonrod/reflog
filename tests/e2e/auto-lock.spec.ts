import { test, expect, type Page } from "@playwright/test";

async function setupVault(page: Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).click();
  await page.keyboard.type("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").click();
  await page.keyboard.type("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("auto-lock behavior", () => {
  test.beforeEach(async ({ page }) => {
    await setupVault(page);
  });

  test("locks vault on visibility change", async ({ page }) => {
    // Simulate visibility change by dispatching the event
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Wait for lock to take effect
    await page.waitForTimeout(500);
    await page.goto("/");
    await expect(page).toHaveURL(/unlock/);
  });

  test("auto-saves draft when navigating away from editor", async ({
    page,
  }) => {
    // Start writing
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Draft content to preserve");

    // Navigate away via Cancel button (client-side nav preserves vault state)
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Come back to new entry — should see draft prompt
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await expect(page.getByText(/unsaved draft/i)).toBeVisible();
  });
});
