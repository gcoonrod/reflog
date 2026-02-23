import db from "@/db";
import * as search from "@/services/search";
import { nowISO, defaultEntryTitle } from "@/utils/date";
import type { Entry, CreateEntryInput, UpdateEntryInput } from "@/types";

function generateId(): string {
  return crypto.randomUUID();
}

export async function create(input: CreateEntryInput): Promise<Entry> {
  const now = nowISO();
  const entry: Entry = {
    id: generateId(),
    title: input.title ?? defaultEntryTitle(),
    body: input.body,
    tags: input.tags ?? [],
    status: "published",
    createdAt: now,
    updatedAt: now,
    syncVersion: 0,
    deletedAt: null,
  };

  await db.entries.add(entry);
  search.addToIndex(entry);
  return entry;
}

export async function getById(id: string): Promise<Entry | null> {
  const entry = await db.entries.get(id);
  if (!entry || entry.deletedAt !== null) return null;
  return entry;
}

export async function list(options?: {
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<Entry[]> {
  let results = (
    await db.entries.where("status").equals("published").toArray()
  ).filter((entry) => entry.deletedAt === null);

  // Sort by createdAt descending (reverse chronological)
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // AND filter: entry must have ALL selected tags
  if (options?.tags && options.tags.length > 0) {
    const requiredTags = options.tags;
    results = results.filter((entry) =>
      requiredTags.every((tag) => entry.tags.includes(tag)),
    );
  }

  if (options?.offset) {
    results = results.slice(options.offset);
  }

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export async function update(
  id: string,
  input: UpdateEntryInput,
): Promise<Entry> {
  const existing = await db.entries.get(id);
  if (!existing) {
    throw new Error(`Entry not found: ${id}`);
  }

  const updated: Entry = {
    ...existing,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.body !== undefined && { body: input.body }),
    ...(input.tags !== undefined && { tags: input.tags }),
    updatedAt: nowISO(),
  };

  await db.entries.put(updated);
  search.updateInIndex(updated);
  return updated;
}

export async function remove(id: string): Promise<void> {
  await db.entries.delete(id);
  search.removeFromIndex(id);
}

// Draft methods

export async function saveDraft(
  input: CreateEntryInput,
  entryId?: string,
): Promise<Entry> {
  const now = nowISO();

  if (entryId) {
    // Update existing entry as draft
    const existing = await db.entries.get(entryId);
    if (existing) {
      const updated: Entry = {
        ...existing,
        ...(input.title !== undefined && { title: input.title }),
        body: input.body,
        ...(input.tags !== undefined && { tags: input.tags }),
        status: "draft",
        updatedAt: now,
      };
      await db.entries.put(updated);
      return updated;
    }
  }

  // Create new draft
  const draft: Entry = {
    id: entryId ?? generateId(),
    title: input.title ?? defaultEntryTitle(),
    body: input.body,
    tags: input.tags ?? [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    syncVersion: 0,
    deletedAt: null,
  };

  await db.entries.put(draft);
  return draft;
}

export async function getDraft(entryId?: string): Promise<Entry | null> {
  if (entryId) {
    const entry = await db.entries.get(entryId);
    return entry?.status === "draft" ? entry : null;
  }

  // Find any new (non-associated) draft
  const drafts = await db.entries.where("status").equals("draft").toArray();

  return drafts[0] ?? null;
}

export async function publishDraft(draftId: string): Promise<Entry> {
  const draft = await db.entries.get(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  if (draft.status !== "draft") {
    throw new Error(`Entry is not a draft: ${draftId}`);
  }

  const published: Entry = {
    ...draft,
    status: "published",
    updatedAt: nowISO(),
  };

  await db.entries.put(published);
  search.addToIndex(published);
  return published;
}

export async function discardDraft(draftId: string): Promise<void> {
  const draft = await db.entries.get(draftId);
  if (draft?.status === "draft") {
    await db.entries.delete(draftId);
  }
}
