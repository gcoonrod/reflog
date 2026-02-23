import { test, expect, type Page } from "@playwright/test";

async function setupAndCreateEntries(page: Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).click();
  await page.keyboard.type("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").click();
  await page.keyboard.type("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);

  // Create several entries with distinct content
  const entries = [
    "Debugging React hooks performance issue",
    "TypeScript generics deep dive",
    "Node.js streaming patterns",
    "CSS Grid layout tricks",
    "Rust ownership and borrowing",
  ];

  for (const content of entries) {
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill(content);
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);
  }
}

test.describe("search palette", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndCreateEntries(page);
  });

  test("opens with Cmd+K and shows results", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/search entries/i)).toBeVisible();
  });

  test("finds entries by keyword", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/search entries/i).fill("React");

    await expect(page.getByText("Debugging React hooks")).toBeVisible();
  });

  test("shows no results for non-matching query", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/search entries/i).fill("zzzznonexistent");

    await expect(page.getByText(/no matching entries/i)).toBeVisible();
  });

  test("navigates to entry on result click", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/search entries/i).fill("TypeScript");

    // Wait for debounced search results to appear, then click the first result
    await page.locator("button[data-action]").first().click();
    await expect(page).toHaveURL(/entry\//);
  });
});
