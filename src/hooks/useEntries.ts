import { useLiveQuery } from "dexie-react-hooks";
import * as entryService from "@/services/entries";

export function useEntries(options?: { tags?: string[] }) {
  const entries = useLiveQuery(
    () => entryService.list(options),
    [options?.tags?.join(",")],
  );

  return {
    entries: entries ?? [],
    isLoading: entries === undefined,
    create: entryService.create,
    update: entryService.update,
    remove: entryService.remove,
    saveDraft: entryService.saveDraft,
    getDraft: entryService.getDraft,
    publishDraft: entryService.publishDraft,
    discardDraft: entryService.discardDraft,
  };
}

export function useEntry(id: string) {
  const entry = useLiveQuery(() => entryService.getById(id), [id]);

  return {
    entry: entry ?? null,
    isLoading: entry === undefined,
  };
}
