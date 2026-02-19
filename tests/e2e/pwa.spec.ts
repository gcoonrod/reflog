import { test, expect } from "@playwright/test";

test.describe("PWA features", () => {
  test("serves a valid web manifest", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe("Reflog");
    expect(manifest.short_name).toBe("Reflog");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("registers a service worker", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    const swRegistered = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });

    expect(swRegistered).toBe(true);
  });

  test("PWA icons are accessible", async ({ page }) => {
    const icon192 = await page.goto("/icons/icon-192x192.png");
    expect(icon192?.status()).toBe(200);

    const icon512 = await page.goto("/icons/icon-512x512.png");
    expect(icon512?.status()).toBe(200);
  });
});
