import MiniSearch from "minisearch";
import type { Entry, SearchResult } from "@/types";

const MAX_RESULTS = 50;

let index: MiniSearch<Entry> | null = null;

function createIndex(): MiniSearch<Entry> {
  return new MiniSearch<Entry>({
    fields: ["title", "body"],
    storeFields: ["id", "title", "createdAt", "tags"],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 2 },
    },
  });
}

export function buildIndex(entries: Entry[]): void {
  index = createIndex();
  index.addAll(entries);
}

export function search(query: string): SearchResult[] {
  if (!index || !query.trim()) return [];

  const results = index.search(query).slice(0, MAX_RESULTS);

  return results.map((r) => ({
    entryId: String(r.id),
    title: String(r.title ?? ""),
    snippet: extractSnippet(r.match, query),
    score: r.score,
    createdAt: String(r.createdAt ?? ""),
    tags: (Array.isArray(r.tags) ? r.tags : []) as string[],
  }));
}

export function addToIndex(entry: Entry): void {
  if (!index) return;
  index.add(entry);
}

export function updateInIndex(entry: Entry): void {
  if (!index) return;
  index.replace(entry);
}

export function removeFromIndex(entryId: string): void {
  if (!index) return;
  index.discard(entryId);
}

export function clearIndex(): void {
  index = null;
}

function extractSnippet(
  match: Record<string, string[]>,
  query: string,
): string {
  // Return the first matched field info as a simple snippet indicator
  const matchedFields = Object.values(match).flat();
  if (matchedFields.length > 0) {
    return `Matched in: ${matchedFields.join(", ")}`;
  }
  return query;
}
