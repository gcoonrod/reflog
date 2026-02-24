import db from "@/db";
import type { TagWithCount } from "@/types";

const TAG_PATTERN = /(?:^|\s)#([a-zA-Z0-9][\w-]*)/g;

/**
 * Normalize a raw tag string to canonical form.
 * Rules: strip #, lowercase, spaces/underscores→hyphens, strip invalid chars,
 * collapse hyphens, trim edge hyphens.
 */
export function normalize(raw: string): string {
  let tag = raw.startsWith("#") ? raw.slice(1) : raw;
  tag = tag.toLowerCase();
  tag = tag.replace(/[\s_]/g, "-");
  tag = tag.replace(/[^a-z0-9-]/g, "");
  tag = tag.replace(/-{2,}/g, "-");
  tag = tag.replace(/^-+|-+$/g, "");
  return tag;
}

/**
 * Extract tags from Markdown body content.
 * Finds all #tag-name patterns and normalizes them.
 */
export function extractFromBody(body: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(body)) !== null) {
    const captured = match[1] ?? "";
    const normalized = normalize(captured);
    if (normalized.length > 0) {
      tags.add(normalized);
    }
  }

  return [...tags];
}

/**
 * Merge tags from body extraction and explicit tag input.
 * Deduplicates and normalizes.
 */
export function mergeTags(
  bodyTags: string[],
  explicitTags: string[],
): string[] {
  const merged = new Set<string>();

  for (const tag of bodyTags) {
    const normalized = normalize(tag);
    if (normalized.length > 0) {
      merged.add(normalized);
    }
  }

  for (const tag of explicitTags) {
    const normalized = normalize(tag);
    if (normalized.length > 0) {
      merged.add(normalized);
    }
  }

  return [...merged];
}

/**
 * Get all unique tags across all published entries with counts.
 * Sorted by count descending.
 */
export async function getAllWithCounts(): Promise<TagWithCount[]> {
  const entries = await db.entries
    .where("status")
    .equals("published")
    .toArray();

  const counts = new Map<string, number>();

  for (const entry of entries) {
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
