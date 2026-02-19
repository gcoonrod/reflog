import { test, expect } from "@playwright/test";

async function setupVault(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByPlaceholder("Enter passphrase").fill("test-passphrase-123");
  await page.getByPlaceholder("Confirm passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("offline functionality", () => {
  test("app loads after going offline", async ({ page, context }) => {
    await setupVault(page);

    // Create an entry while online
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Created while online");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Go offline
    await context.setOffline(true);

    // Reload — app should still work (served from service worker cache)
    await page.goto("/timeline");
    await expect(page.getByText("Created while online")).toBeVisible();
  });

  test("can create entries while offline", async ({ page, context }) => {
    await setupVault(page);

    // Go offline
    await context.setOffline(true);

    // Create entry while offline
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Created while offline");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page).toHaveURL(/timeline/);
    await expect(page.getByText("Created while offline")).toBeVisible();
  });

  test("search works while offline", async ({ page, context }) => {
    await setupVault(page);

    // Create entries
    await page.getByRole("button", { name: /new entry/i }).click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Searchable offline content");
    await page.getByRole("button", { name: /save/i }).click();

    // Go offline
    await context.setOffline(true);

    // Search should still work (in-memory index)
    await page.keyboard.press("Meta+k");
    await page.getByPlaceholder(/search entries/i).fill("Searchable");
    await expect(page.getByText("Searchable offline")).toBeVisible();
  });
});
