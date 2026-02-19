import { useState } from "react";
import { Group, TextInput, ActionIcon, ScrollArea, Text } from "@mantine/core";
import type { TagWithCount } from "@/types";
import { TagBadge } from "./TagBadge";

interface TagFilterBarProps {
  allTags: TagWithCount[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function TagFilterBar({
  allTags,
  selectedTags,
  onToggle,
  onClear,
}: TagFilterBarProps) {
  const [filter, setFilter] = useState("");

  if (allTags.length === 0) return null;

  const filtered = filter
    ? allTags.filter((t) => t.name.includes(filter.toLowerCase()))
    : allTags;

  return (
    <div>
      <Group gap="xs" mb="xs" align="center">
        {allTags.length > 10 && (
          <TextInput
            placeholder="Filter tags..."
            size="xs"
            value={filter}
            onChange={(e) => { setFilter(e.currentTarget.value); }}
            style={{ maxWidth: 160 }}
          />
        )}
        {selectedTags.length > 0 && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onClear}
            title="Clear filters"
          >
            <Text size="xs">✕</Text>
          </ActionIcon>
        )}
      </Group>
      <ScrollArea scrollbarSize={4} type="auto">
        <Group gap={4} wrap="wrap">
          {filtered.map((tag) => (
            <TagBadge
              key={tag.name}
              tag={tag.name}
              count={tag.count}
              selected={selectedTags.includes(tag.name)}
              onClick={onToggle}
            />
          ))}
        </Group>
      </ScrollArea>
    </div>
  );
}
