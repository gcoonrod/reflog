import { test, expect } from "@playwright/test";

async function setupVault(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("offline functionality", () => {
  test("app loads after going offline", async ({ page, context }) => {
    await setupVault(page);

    // Pre-cache the entry/new route chunk by visiting it
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Created while online");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Wait for service worker to activate and claim the page
    await page.waitForTimeout(1000);

    // Reload while still online so the now-active SW intercepts
    // and caches all JS/CSS assets (the initial page load happens
    // before the SW takes control, so assets bypass the cache).
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Go offline
    await context.setOffline(true);

    // Full reload while offline — SW should serve the cached shell.
    // But vault keys are in-memory and destroyed on reload, so we
    // land on the unlock page instead of the timeline.
    await page.goto("/");
    await expect(page.locator("body")).not.toBeEmpty();
    // The app should render (not show net::ERR_INTERNET_DISCONNECTED)
    await expect(page.getByLabel("Passphrase")).toBeVisible();
  });

  test("can create entries while offline", async ({ page, context }) => {
    await setupVault(page);

    // Pre-warm route cache by visiting new entry page, then go back
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await expect(page).toHaveURL(/entry\/new/);
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Go offline — client-side navigation and IndexedDB still work
    await context.setOffline(true);

    // Create entry while offline (all operations are local)
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Created while offline");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page).toHaveURL(/timeline/);
    await expect(page.getByText("Created while offline")).toBeVisible();
  });

  test("search works while offline", async ({ page, context }) => {
    await setupVault(page);

    // Create entries
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Searchable offline content");
    await page.getByRole("button", { name: /save/i }).click();

    // Go offline
    await context.setOffline(true);

    // Search should still work (in-memory index)
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/search entries/i).fill("Searchable");
    await expect(page.getByText("Searchable offline")).toBeVisible();
  });
});
