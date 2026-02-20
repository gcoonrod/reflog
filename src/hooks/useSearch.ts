import { useState, useMemo, useCallback } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import * as searchService from "@/services/search";
import type { SearchResult } from "@/types";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 150);

  const results: SearchResult[] = useMemo(
    () => searchService.search(debouncedQuery),
    [debouncedQuery],
  );

  const clearQuery = useCallback(() => {
    setQuery("");
  }, []);

  return {
    query,
    setQuery,
    results,
    clearQuery,
  };
}
