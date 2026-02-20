import { useState } from "react";
import { Group, TextInput } from "@mantine/core";
import { normalize } from "@/services/tags";
import { TagBadge } from "./TagBadge";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [value, setValue] = useState("");

  function addTag(raw: string) {
    const normalized = normalize(raw);
    if (normalized.length > 0 && !tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
    setValue("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <>
      <TextInput
        placeholder="Add tag and press Enter..."
        size="xs"
        value={value}
        onChange={(e) => { setValue(e.currentTarget.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            addTag(value.trim());
          }
        }}
      />
      {tags.length > 0 && (
        <Group gap={4} mt="xs">
          {tags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              onClick={removeTag}
            />
          ))}
        </Group>
      )}
    </>
  );
}
