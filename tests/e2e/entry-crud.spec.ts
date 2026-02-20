import { test, expect } from "@playwright/test";

async function setupAndUnlock(page: import("@playwright/test").Page) {
  await page.goto("/setup");
  await page.getByLabel("Passphrase", { exact: true }).fill("test-passphrase-123");
  await page.getByLabel("Confirm Passphrase").fill("test-passphrase-123");
  await page.getByRole("button", { name: /create vault/i }).click();
  await expect(page).toHaveURL(/timeline/);
}

test.describe("entry CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndUnlock(page);
  });

  test("creates a new entry and displays it on timeline", async ({ page }) => {
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await expect(page).toHaveURL(/entry\/new/);

    // Type in the CodeMirror editor
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("My first journal entry about debugging.");

    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);

    await expect(page.getByText("My first journal entry")).toBeVisible();
  });

  test("views an entry with rendered content", async ({ page }) => {
    // Create entry
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("# Hello World\n\nSome content");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // Click to view
    await page.getByText("Hello World").click();
    await expect(page).toHaveURL(/entry\//);
    await expect(page.getByText("Some content")).toBeVisible();
  });

  test("edits an entry and shows edited badge", async ({ page }) => {
    // Create entry
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Original content");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // View and edit
    await page.getByText("Original content").click();
    await page.getByRole("button", { name: /edit/i }).click();
    await expect(page).toHaveURL(/edit/);

    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Updated content");
    await page.getByRole("button", { name: /save/i }).click();

    // After save, we're on the entry view page — check edited badge there
    await expect(page.getByText("edited")).toBeVisible();
  });

  test("deletes an entry with confirmation", async ({ page }) => {
    // Create entry
    await page.getByRole("button", { name: /new entry/i }).first().click();
    await page.locator(".cm-editor .cm-content").click();
    await page.locator(".cm-editor .cm-content").fill("Delete me");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(/timeline/);

    // View and delete
    await page.getByText("Delete me").click();
    await page.getByRole("button", { name: /delete/i }).click();

    // Confirm deletion in the modal dialog
    await page.getByRole("dialog").getByRole("button", { name: /delete/i }).click();
    await expect(page).toHaveURL(/timeline/);

    await expect(page.getByText("Delete me")).not.toBeVisible();
  });

  test("shows empty state when no entries exist", async ({ page }) => {
    await expect(page.getByText(/no entries yet/i)).toBeVisible();
  });
});
