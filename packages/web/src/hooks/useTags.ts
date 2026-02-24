import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as tagService from "@/services/tags";

export function useTags() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = useLiveQuery(() => tagService.getAllWithCounts(), []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  return {
    allTags: allTags ?? [],
    selectedTags,
    toggleTag,
    clearTags,
    isLoading: allTags === undefined,
  };
}
