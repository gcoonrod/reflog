import { test, expect } from "@playwright/test";

async function setupVault(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("tag system", () => {
  test.beforeEach(async ({ page }) => {
    await setupVault(page);
  });

  test("extracts inline #tags from body on save", async ({ page }) => {
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Working on #react and #typescript today");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page).toHaveURL(/timeline/);
    await expect(page.getByText("react", { exact: true })).toBeVisible();
    await expect(page.getByText("typescript", { exact: true })).toBeVisible();
  });

  test("adds tags via dedicated tag input", async ({ page }) => {
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Some content");

    await page.getByPlaceholder(/add tag/i).fill("debugging");
    await page.getByPlaceholder(/add tag/i).press("Enter");

    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);
    await expect(page.getByText("debugging", { exact: true })).toBeVisible();
  });

  test("filters timeline by tag (AND logic)", async ({ page }) => {
    // Create entries with different tag combos
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Entry about #react and #typescript");
    await page.getByRole("button", { name: /save/i }).click();

    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Entry about #react only");
    await page.getByRole("button", { name: /save/i }).click();

    // Filter by both tags — only one entry should match
    await page.getByText("react").first().click();
    await page.getByText("typescript").first().click();

    // Only the entry with both tags should be visible
    const entries = page.locator("[data-testid='entry-card']");
    await expect(entries).toHaveCount(1);
  });
});
