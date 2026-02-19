import { test, expect } from "@playwright/test";

async function setupVault(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByPlaceholder("Enter passphrase").fill("test-passphrase-123");
  await page.getByPlaceholder("Confirm passphrase").fill("test-passphrase-123");
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
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Draft content to preserve");

    // Navigate away (triggers draft save)
    await page.goto("/timeline");

    // Come back to new entry — should see draft prompt
    await page.getByRole("button", { name: /new entry/i }).click();
    await expect(page.getByText(/unsaved draft/i)).toBeVisible();
  });
});
