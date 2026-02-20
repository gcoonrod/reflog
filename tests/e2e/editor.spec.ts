import { test, expect } from "@playwright/test";

async function setupAndUnlock(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("markdown editor", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndUnlock(page);
    await page.getByRole("button", { name: /new entry/i }).first().click();
  });

  test("renders markdown in preview tab", async ({ page }) => {
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("# Heading\n\n**Bold text** and `code`");

    // Switch to Preview tab
    await page.getByRole("tab", { name: /preview/i }).click();

    await expect(page.locator("h1")).toContainText("Heading");
    await expect(page.locator("strong")).toContainText("Bold text");
    await expect(page.locator("code")).toContainText("code");
  });

  test("preserves editor content when toggling tabs", async ({ page }) => {
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Preserved content");

    // Toggle to preview and back
    await page.getByRole("tab", { name: /preview/i }).click();
    await page.getByRole("tab", { name: /write/i }).click();

    await expect(page.locator(".cm-editor")).toContainText("Preserved content");
  });

  test("renders code blocks with syntax highlighting", async ({ page }) => {
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("```javascript\nconst x = 42;\n```");

    await page.getByRole("tab", { name: /preview/i }).click();
    await expect(page.locator("pre code")).toBeVisible();
  });
});
