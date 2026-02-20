import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import * as vault from "@/services/vault";
import * as entries from "@/services/entries";

beforeEach(async () => {
  await vault.setup("test-passphrase");
});

afterEach(async () => {
  const { default: db } = await import("@/db");
  await db.entries.clear();
  await db.vault_meta.clear();
  vault.lock();
});

describe("entry service", () => {
  it("creates an entry with default title", async () => {
    const entry = await entries.create({ body: "Hello world" });
    expect(entry.id).toBeDefined();
    expect(entry.title).toBeTruthy();
    expect(entry.body).toBe("Hello world");
    expect(entry.status).toBe("published");
    expect(entry.tags).toEqual([]);
    expect(entry.createdAt).toBe(entry.updatedAt);
  });

  it("creates an entry with explicit title and tags", async () => {
    const entry = await entries.create({
      title: "My Entry",
      body: "Content",
      tags: ["test", "demo"],
    });
    expect(entry.title).toBe("My Entry");
    expect(entry.tags).toEqual(["test", "demo"]);
  });

  it("gets an entry by id", async () => {
    const created = await entries.create({ body: "test" });
    const found = await entries.getById(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.body).toBe("test");
  });

  it("returns null for non-existent entry", async () => {
    const found = await entries.getById("non-existent");
    expect(found).toBeNull();
  });

  it("lists published entries in reverse chronological order", async () => {
    await entries.create({ title: "First", body: "a" });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await entries.create({ title: "Second", body: "b" });
    await new Promise((r) => setTimeout(r, 10));
    await entries.create({ title: "Third", body: "c" });

    const result = await entries.list();
    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("Third");
    expect(result[2]!.title).toBe("First");
  });

  it("excludes drafts from list", async () => {
    await entries.create({ body: "published" });
    await entries.saveDraft({ body: "draft content" });

    const result = await entries.list();
    expect(result).toHaveLength(1);
    expect(result[0]!.body).toBe("published");
  });

  it("filters entries by tags (AND logic)", async () => {
    await entries.create({ body: "a", tags: ["react", "typescript"] });
    await entries.create({ body: "b", tags: ["react"] });
    await entries.create({ body: "c", tags: ["typescript"] });

    const reactAndTs = await entries.list({ tags: ["react", "typescript"] });
    expect(reactAndTs).toHaveLength(1);
    expect(reactAndTs[0]!.body).toBe("a");

    const reactOnly = await entries.list({ tags: ["react"] });
    expect(reactOnly).toHaveLength(2);
  });

  it("updates an entry", async () => {
    const created = await entries.create({ title: "Old", body: "old body" });
    // Ensure different timestamp
    await new Promise((r) => setTimeout(r, 10));
    const updated = await entries.update(created.id, {
      title: "New",
      body: "new body",
    });
    expect(updated.title).toBe("New");
    expect(updated.body).toBe("new body");
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it("throws when updating non-existent entry", async () => {
    await expect(
      entries.update("missing", { body: "nope" }),
    ).rejects.toThrow("Entry not found");
  });

  it("deletes an entry", async () => {
    const created = await entries.create({ body: "to delete" });
    await entries.remove(created.id);
    const found = await entries.getById(created.id);
    expect(found).toBeNull();
  });
});

describe("draft methods", () => {
  it("saves and retrieves a draft", async () => {
    const draft = await entries.saveDraft({ body: "draft content" });
    expect(draft.status).toBe("draft");

    const found = await entries.getDraft();
    expect(found).toBeDefined();
    expect(found!.body).toBe("draft content");
  });

  it("publishes a draft", async () => {
    const draft = await entries.saveDraft({ body: "ready to publish" });
    const published = await entries.publishDraft(draft.id);
    expect(published.status).toBe("published");
    expect(published.body).toBe("ready to publish");
  });

  it("discards a draft", async () => {
    const draft = await entries.saveDraft({ body: "discard me" });
    await entries.discardDraft(draft.id);
    const found = await entries.getDraft();
    expect(found).toBeNull();
  });

  it("throws when publishing non-existent draft", async () => {
    await expect(entries.publishDraft("missing")).rejects.toThrow(
      "Draft not found",
    );
  });
});
