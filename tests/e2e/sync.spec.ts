// T060: E2E tests for cross-device sync flow.
// Requires Auth0 test credentials and a running sync API.
// Uses separate Playwright browser contexts to simulate multi-device sync.
// Skip with: SKIP_SYNC_E2E=1 yarn test:e2e

import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const AUTH0_USERNAME = process.env.E2E_AUTH0_USERNAME;
const AUTH0_PASSWORD = process.env.E2E_AUTH0_PASSWORD;
const HAS_CREDENTIALS = AUTH0_USERNAME && AUTH0_PASSWORD;

async function loginAndUnlock(page: Page, passphrase: string): Promise<void> {
  await page.goto("/");
  const loginButton = page.getByRole("button", { name: /log in|sign in/i });
  await loginButton.click();

  await page.fill('input[name="username"], input[name="email"]', AUTH0_USERNAME!);
  await page.fill('input[name="password"]', AUTH0_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost/);

  // Unlock vault
  const passphraseInput = page.getByPlaceholder(/passphrase/i);
  await passphraseInput.fill(passphrase);
  await page.getByRole("button", { name: /unlock/i }).click();

  // Wait for app to load
  await page.waitForSelector('[data-testid="app-loaded"], main', { timeout: 10000 });
}

test.describe("cross-device sync", () => {
  test.skip(!HAS_CREDENTIALS, "Auth0 test credentials not configured");

  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two separate browser contexts (simulating different devices)
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
  });

  test.afterEach(async () => {
    await contextA?.close();
    await contextB?.close();
  });

  test("entry created on device A appears on device B", async () => {
    // Login on both devices with same credentials
    await loginAndUnlock(pageA, "test-passphrase");
    await loginAndUnlock(pageB, "test-passphrase");

    // Create entry on device A
    await pageA.getByRole("button", { name: /new|create|add/i }).click();
    const editor = pageA.locator(".cm-editor, [data-testid='editor']");
    await editor.click();
    await pageA.keyboard.type("Sync test entry from device A");
    await pageA.getByRole("button", { name: /save|publish/i }).click();

    // Wait for sync to propagate (poll device B)
    await pageB.waitForTimeout(5000);
    await pageB.reload();

    // Verify entry appears on device B
    const entryText = pageB.getByText("Sync test entry from device A");
    await expect(entryText).toBeVisible({ timeout: 15000 });
  });

  test("offline queue syncs after reconnection", async () => {
    await loginAndUnlock(pageA, "test-passphrase");

    // Go offline
    await pageA.context().setOffline(true);

    // Create entry while offline
    await pageA.getByRole("button", { name: /new|create|add/i }).click();
    const editor = pageA.locator(".cm-editor, [data-testid='editor']");
    await editor.click();
    await pageA.keyboard.type("Offline entry - should sync later");
    await pageA.getByRole("button", { name: /save|publish/i }).click();

    // Verify sync indicator shows offline state
    const syncIndicator = pageA.locator('[data-testid="sync-status"], [aria-label*="sync"]');
    if (await syncIndicator.isVisible()) {
      await expect(syncIndicator).toContainText(/offline/i);
    }

    // Go back online
    await pageA.context().setOffline(false);

    // Wait for sync to complete
    await pageA.waitForTimeout(5000);

    // Login on device B and verify the entry synced
    await loginAndUnlock(pageB, "test-passphrase");
    const entryText = pageB.getByText("Offline entry - should sync later");
    await expect(entryText).toBeVisible({ timeout: 15000 });
  });
});
