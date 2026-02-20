import { test, expect } from "@playwright/test";

async function setupVault(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("draft save and restore", () => {
  test.beforeEach(async ({ page }) => {
    await setupVault(page);
  });

  test("prompts to resume or discard existing draft", async ({ page }) => {
    // Create draft by navigating away via Cancel (client-side nav preserves vault state)
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("My draft content");
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Open new entry — should see prompt
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await expect(page.getByText(/unsaved draft/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /start fresh/i })).toBeVisible();
  });

  test("resumes draft with original content", async ({ page }) => {
    // Create draft
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Resume this content");
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Resume draft
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.getByRole("button", { name: /resume/i }).click();

    await expect(page.locator(".cm-editor")).toContainText("Resume this content");
  });

  test("discards draft when starting fresh", async ({ page }) => {
    // Create draft
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Discard this");
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Start fresh
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.getByRole("button", { name: /start fresh/i }).click();

    // Editor should be empty
    await expect(page.locator(".cm-editor")).not.toContainText("Discard this");
  });
});
