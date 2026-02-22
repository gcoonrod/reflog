// T059: E2E tests for authentication flows.
// Requires Auth0 test credentials: E2E_AUTH0_USERNAME and E2E_AUTH0_PASSWORD env vars.
// Skip with: SKIP_AUTH_E2E=1 yarn test:e2e

import { test, expect } from "@playwright/test";

const AUTH0_USERNAME = process.env.E2E_AUTH0_USERNAME;
const AUTH0_PASSWORD = process.env.E2E_AUTH0_PASSWORD;
const HAS_CREDENTIALS = AUTH0_USERNAME && AUTH0_PASSWORD;

test.describe("authentication flow", () => {
  test.skip(!HAS_CREDENTIALS, "Auth0 test credentials not configured");

  test("login redirects to Auth0 and returns to app", async ({ page }) => {
    await page.goto("/");

    // Click the login button
    const loginButton = page.getByRole("button", { name: /log in|sign in/i });
    await loginButton.click();

    // Should redirect to Auth0 Universal Login
    await expect(page).toHaveURL(/auth0\.com/);

    // Fill Auth0 login form
    await page.fill('input[name="username"], input[name="email"]', AUTH0_USERNAME!);
    await page.fill('input[name="password"]', AUTH0_PASSWORD!);
    await page.click('button[type="submit"]');

    // Should redirect back to app after successful login
    await page.waitForURL(/localhost/);
    await expect(page).not.toHaveURL(/auth0\.com/);
  });

  test("authenticated user sees vault unlock prompt", async ({ page }) => {
    // Navigate and login
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /log in|sign in/i });
    await loginButton.click();

    await page.fill('input[name="username"], input[name="email"]', AUTH0_USERNAME!);
    await page.fill('input[name="password"]', AUTH0_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/localhost/);

    // Should see vault unlock or setup prompt
    const passphrase = page.getByPlaceholder(/passphrase/i);
    await expect(passphrase).toBeVisible({ timeout: 10000 });
  });

  test("logout clears session", async ({ page }) => {
    // Login first
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /log in|sign in/i });
    await loginButton.click();
    await page.fill('input[name="username"], input[name="email"]', AUTH0_USERNAME!);
    await page.fill('input[name="password"]', AUTH0_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/localhost/);

    // Open account menu and logout
    const accountMenu = page.getByRole("button", { name: /account|profile|menu/i });
    await accountMenu.click();
    const logoutButton = page.getByRole("menuitem", { name: /log out/i });
    await logoutButton.click();

    // Should return to landing/login page
    await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("lock requires passphrase to resume", async ({ page }) => {
    // Login and unlock vault
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /log in|sign in/i });
    await loginButton.click();
    await page.fill('input[name="username"], input[name="email"]', AUTH0_USERNAME!);
    await page.fill('input[name="password"]', AUTH0_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/localhost/);

    // Unlock vault with passphrase
    const passphrase = page.getByPlaceholder(/passphrase/i);
    await passphrase.fill("test-passphrase");
    await page.getByRole("button", { name: /unlock/i }).click();

    // Lock the vault using keyboard shortcut (Shift+Meta+L)
    await page.keyboard.press("Shift+Meta+L");

    // Should show lock screen with passphrase input
    await expect(page.getByPlaceholder(/passphrase/i)).toBeVisible({ timeout: 5000 });
  });
});
