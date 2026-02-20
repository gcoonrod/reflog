import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import * as tagService from "@/services/tags";
import * as vault from "@/services/vault";
import * as entries from "@/services/entries";

describe("tag normalization", () => {
  it("strips leading # symbol", () => {
    expect(tagService.normalize("#react")).toBe("react");
  });

  it("converts to lowercase", () => {
    expect(tagService.normalize("Architecture")).toBe("architecture");
    expect(tagService.normalize("BUG-HUNT")).toBe("bug-hunt");
  });

  it("replaces spaces with hyphens", () => {
    expect(tagService.normalize("Bug Hunt")).toBe("bug-hunt");
    expect(tagService.normalize("code review notes")).toBe("code-review-notes");
  });

  it("replaces underscores with hyphens", () => {
    expect(tagService.normalize("React_Components")).toBe("react-components");
  });

  it("removes invalid characters", () => {
    expect(tagService.normalize("C++")).toBe("c");
    expect(tagService.normalize("tag@name!")).toBe("tagname");
  });

  it("collapses consecutive hyphens", () => {
    expect(tagService.normalize("a--b---c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(tagService.normalize("-leading")).toBe("leading");
    expect(tagService.normalize("trailing-")).toBe("trailing");
    expect(tagService.normalize("-both-")).toBe("both");
  });

  it("handles combined normalization", () => {
    expect(tagService.normalize("#Bug Hunt")).toBe("bug-hunt");
    expect(tagService.normalize("#React_Components")).toBe("react-components");
    expect(tagService.normalize("  spaced  out  ")).toBe("spaced-out");
  });
});

describe("extractFromBody", () => {
  it("extracts inline #tag patterns", () => {
    const body = "Today I worked on #react and #typescript issues";
    expect(tagService.extractFromBody(body)).toEqual(
      expect.arrayContaining(["react", "typescript"]),
    );
  });

  it("extracts tag at start of line", () => {
    const body = "#debugging session today";
    expect(tagService.extractFromBody(body)).toEqual(["debugging"]);
  });

  it("normalizes extracted tags", () => {
    const body = "Working on #React_Components and #BugHunt";
    const tags = tagService.extractFromBody(body);
    expect(tags).toContain("react-components");
    expect(tags).toContain("bughunt");
  });

  it("deduplicates extracted tags", () => {
    const body = "I love #react. Did I mention #react?";
    expect(tagService.extractFromBody(body)).toEqual(["react"]);
  });

  it("returns empty array for body with no tags", () => {
    expect(tagService.extractFromBody("No tags here")).toEqual([]);
  });

  it("ignores hash inside words (e.g. URLs)", () => {
    const body = "Check out example.com/#section for details";
    // The # is preceded by /, not whitespace, so should not match
    expect(tagService.extractFromBody(body)).toEqual([]);
  });
});

describe("mergeTags", () => {
  it("merges body and explicit tags", () => {
    const result = tagService.mergeTags(["react", "hooks"], ["typescript"]);
    expect(result).toEqual(expect.arrayContaining(["react", "hooks", "typescript"]));
    expect(result).toHaveLength(3);
  });

  it("deduplicates across sources", () => {
    const result = tagService.mergeTags(["react", "hooks"], ["react", "new-tag"]);
    expect(result).toHaveLength(3);
    expect(result).toContain("react");
    expect(result).toContain("hooks");
    expect(result).toContain("new-tag");
  });

  it("normalizes during merge", () => {
    const result = tagService.mergeTags(["#React"], ["react"]);
    expect(result).toEqual(["react"]);
  });

  it("filters empty results from normalization", () => {
    const result = tagService.mergeTags(["+++"], ["valid"]);
    expect(result).toEqual(["valid"]);
  });
});

describe("getAllWithCounts", () => {
  beforeEach(async () => {
    await vault.setup("test-passphrase");
  });

  afterEach(async () => {
    const { default: db } = await import("@/db");
    await db.entries.clear();
    await db.vault_meta.clear();
    vault.lock();
  });

  it("aggregates tag counts from published entries", async () => {
    await entries.create({ body: "a", tags: ["react", "typescript"] });
    await entries.create({ body: "b", tags: ["react"] });
    await entries.create({ body: "c", tags: ["typescript", "node"] });

    const result = await tagService.getAllWithCounts();
    expect(result).toEqual([
      { name: "react", count: 2 },
      { name: "typescript", count: 2 },
      { name: "node", count: 1 },
    ]);
  });

  it("returns empty array when no entries exist", async () => {
    const result = await tagService.getAllWithCounts();
    expect(result).toEqual([]);
  });

  it("excludes tags from draft entries", async () => {
    await entries.create({ body: "published", tags: ["visible"] });
    await entries.saveDraft({ body: "draft", tags: ["hidden"] });

    const result = await tagService.getAllWithCounts();
    expect(result).toEqual([{ name: "visible", count: 1 }]);
  });

  it("sorts by count descending", async () => {
    await entries.create({ body: "a", tags: ["rare"] });
    await entries.create({ body: "b", tags: ["common", "rare"] });
    await entries.create({ body: "c", tags: ["common"] });
    await entries.create({ body: "d", tags: ["common"] });

    const result = await tagService.getAllWithCounts();
    expect(result[0]!.name).toBe("common");
    expect(result[0]!.count).toBe(3);
    expect(result[1]!.name).toBe("rare");
    expect(result[1]!.count).toBe(2);
  });
});
