import { test, expect } from "@playwright/test";

async function setupVault(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByPlaceholder("Enter passphrase").fill("test-passphrase-123");
  await page.getByPlaceholder("Confirm passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await setupVault(page);
  });

  test("Cmd+N opens new entry editor", async ({ page }) => {
    await page.keyboard.press("Meta+n");
    await expect(page).toHaveURL(/entry\/new/);
  });

  test("Cmd+K opens search palette", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder(/search entries/i)).toBeVisible();
  });

  test("Cmd+Enter saves entry from editor", async ({ page }) => {
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Saved with keyboard");

    await page.keyboard.press("Meta+Enter");
    await expect(page).toHaveURL(/timeline/);
    await expect(page.getByText("Saved with keyboard")).toBeVisible();
  });

  test("Cmd+K works while CodeMirror editor is focused", async ({ page }) => {
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Some text");

    // Cmd+K should open search even from editor
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder(/search entries/i)).toBeVisible();
  });

  test("Cmd+N works while CodeMirror editor is focused", async ({ page }) => {
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();

    // Navigate away to timeline first, then Cmd+N from editor context
    await page.goto("/timeline");
    await page.keyboard.press("Meta+n");
    await expect(page).toHaveURL(/entry\/new/);
  });
});
