import { Stack } from "@mantine/core";
import { EntryCard } from "./EntryCard";
import type { Entry } from "@/types";

interface EntryListProps {
  entries: Entry[];
}

export function EntryList({ entries }: EntryListProps) {
  return (
    <Stack gap="sm">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </Stack>
  );
}
