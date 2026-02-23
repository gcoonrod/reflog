import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as searchService from "@/services/search";
import type { Entry } from "@/types";

function makeEntry(overrides: Partial<Entry> & { id: string }): Entry {
  return {
    title: "Untitled",
    body: "",
    tags: [],
    status: "published",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncVersion: 0,
    deletedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  searchService.clearIndex();
});

describe("search service", () => {
  describe("buildIndex", () => {
    it("indexes entries and makes them searchable", () => {
      const entries = [
        makeEntry({ id: "1", title: "React hooks guide", body: "useState and useEffect" }),
        makeEntry({ id: "2", title: "TypeScript tips", body: "Generics and utility types" }),
      ];

      searchService.buildIndex(entries);

      const results = searchService.search("React");
      expect(results).toHaveLength(1);
      expect(results[0]!.entryId).toBe("1");
      expect(results[0]!.title).toBe("React hooks guide");
    });

    it("replaces existing index when called again", () => {
      searchService.buildIndex([
        makeEntry({ id: "1", title: "Old entry", body: "old content" }),
      ]);
      searchService.buildIndex([
        makeEntry({ id: "2", title: "New entry", body: "new content" }),
      ]);

      expect(searchService.search("Old")).toHaveLength(0);
      expect(searchService.search("New")).toHaveLength(1);
    });
  });

  describe("search", () => {
    beforeEach(() => {
      searchService.buildIndex([
        makeEntry({
          id: "1",
          title: "React hooks guide",
          body: "Learn about useState and useEffect hooks",
          tags: ["react", "hooks"],
          createdAt: "2026-01-15T10:00:00.000Z",
        }),
        makeEntry({
          id: "2",
          title: "TypeScript generics",
          body: "Advanced type patterns with generics",
          tags: ["typescript"],
          createdAt: "2026-01-16T10:00:00.000Z",
        }),
        makeEntry({
          id: "3",
          title: "Debugging Node.js",
          body: "Tips for debugging Node applications",
          tags: ["node", "debugging"],
          createdAt: "2026-01-17T10:00:00.000Z",
        }),
      ]);
    });

    it("returns empty array for empty query", () => {
      expect(searchService.search("")).toEqual([]);
      expect(searchService.search("   ")).toEqual([]);
    });

    it("returns empty array when index is not built", () => {
      searchService.clearIndex();
      expect(searchService.search("React")).toEqual([]);
    });

    it("returns matching results with correct shape", () => {
      const results = searchService.search("React");
      expect(results).toHaveLength(1);

      const result = results[0]!;
      expect(result.entryId).toBe("1");
      expect(result.title).toBe("React hooks guide");
      expect(result.score).toBeGreaterThan(0);
      expect(result.createdAt).toBe("2026-01-15T10:00:00.000Z");
      expect(result.tags).toEqual(["react", "hooks"]);
      expect(result.snippet).toBeDefined();
    });

    it("supports prefix matching", () => {
      const results = searchService.search("Type");
      expect(results).toHaveLength(1);
      expect(results[0]!.entryId).toBe("2");
    });

    it("supports fuzzy matching", () => {
      // "Reakt" is edit distance 1 from "React" (c→k), within fuzzy: 0.2 threshold
      const results = searchService.search("Reakt");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.entryId === "1")).toBe(true);
    });

    it("searches body content", () => {
      const results = searchService.search("useState");
      expect(results).toHaveLength(1);
      expect(results[0]!.entryId).toBe("1");
    });

    it("boosts title matches over body matches", () => {
      // "hooks" appears in both title and body of entry 1
      // Add another entry where "hooks" only appears in body
      searchService.clearIndex();
      searchService.buildIndex([
        makeEntry({ id: "a", title: "React hooks", body: "Guide content" }),
        makeEntry({ id: "b", title: "Guide content", body: "About hooks in React" }),
      ]);

      const results = searchService.search("hooks");
      expect(results).toHaveLength(2);
      // Title match should score higher
      expect(results[0]!.entryId).toBe("a");
    });

    it("returns multiple matches", () => {
      // "Node" matches entry 3 title, "debugging" also matches
      const results = searchService.search("debugging");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.entryId === "3")).toBe(true);
    });
  });

  describe("incremental index operations", () => {
    beforeEach(() => {
      searchService.buildIndex([
        makeEntry({ id: "1", title: "Initial entry", body: "Starting content" }),
      ]);
    });

    it("addToIndex makes new entry searchable", () => {
      searchService.addToIndex(
        makeEntry({ id: "2", title: "Added entry", body: "New content" }),
      );

      const results = searchService.search("Added");
      expect(results).toHaveLength(1);
      expect(results[0]!.entryId).toBe("2");
    });

    it("updateInIndex reflects changed content", () => {
      searchService.updateInIndex(
        makeEntry({ id: "1", title: "Updated title", body: "Changed content" }),
      );

      expect(searchService.search("Initial")).toHaveLength(0);
      expect(searchService.search("Updated")).toHaveLength(1);
    });

    it("removeFromIndex makes entry unsearchable", () => {
      searchService.removeFromIndex("1");
      expect(searchService.search("Initial")).toHaveLength(0);
    });

    it("addToIndex no-ops when index is null", () => {
      searchService.clearIndex();
      // Should not throw
      searchService.addToIndex(
        makeEntry({ id: "2", title: "Added entry", body: "content" }),
      );
    });

    it("updateInIndex no-ops when index is null", () => {
      searchService.clearIndex();
      searchService.updateInIndex(
        makeEntry({ id: "1", title: "Updated", body: "content" }),
      );
    });

    it("removeFromIndex no-ops when index is null", () => {
      searchService.clearIndex();
      searchService.removeFromIndex("1");
    });
  });

  describe("clearIndex", () => {
    it("makes all searches return empty", () => {
      searchService.buildIndex([
        makeEntry({ id: "1", title: "Searchable", body: "content" }),
      ]);

      expect(searchService.search("Searchable")).toHaveLength(1);

      searchService.clearIndex();

      expect(searchService.search("Searchable")).toEqual([]);
    });
  });
});
