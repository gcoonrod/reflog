import { describe, it, expect } from "vitest";
import * as searchService from "@/services/search";
import type { Entry } from "@/types";

function generateEntries(count: number): Entry[] {
  const tags = ["react", "typescript", "node", "debugging", "architecture", "performance"];
  const entries: Entry[] = [];

  for (let i = 0; i < count; i++) {
    entries.push({
      id: `entry-${i}`,
      title: `Entry ${i}: ${tags[i % tags.length]} session notes`,
      body: `This is the body of entry ${i}. It contains various technical content about ${tags[i % tags.length]} and related topics. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Debugging session involved tracing through multiple layers of abstraction.`,
      tags: [tags[i % tags.length]!, tags[(i + 1) % tags.length]!],
      status: "published",
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
    });
  }

  return entries;
}

describe("search performance", () => {
  it("builds index for 1000 entries in under 500ms", () => {
    const entries = generateEntries(1000);

    const start = performance.now();
    searchService.buildIndex(entries);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    searchService.clearIndex();
  });

  it("queries 1000-entry index in under 50ms", () => {
    const entries = generateEntries(1000);
    searchService.buildIndex(entries);

    const queries = ["react", "debugging", "typescript notes", "Lorem", "entry 500"];
    const times: number[] = [];

    for (const query of queries) {
      const start = performance.now();
      const results = searchService.search(query);
      const elapsed = performance.now() - start;
      times.push(elapsed);
      expect(results.length).toBeGreaterThan(0);
    }

    const maxTime = Math.max(...times);
    expect(maxTime).toBeLessThan(50);

    searchService.clearIndex();
  });

  it("incremental add to 1000-entry index completes in under 10ms", () => {
    const entries = generateEntries(1000);
    searchService.buildIndex(entries);

    const newEntry: Entry = {
      id: "new-entry",
      title: "Brand new entry",
      body: "Fresh content to add to the index",
      tags: ["new"],
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const start = performance.now();
    searchService.addToIndex(newEntry);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);

    const results = searchService.search("Brand new");
    expect(results.length).toBeGreaterThan(0);

    searchService.clearIndex();
  });
});
