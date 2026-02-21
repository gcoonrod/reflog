import { Badge } from "@mantine/core";

interface TagBadgeProps {
  tag: string;
  count?: number;
  selected?: boolean;
  onClick?: (tag: string) => void;
}

export function TagBadge({ tag, count, selected, onClick }: TagBadgeProps) {
  return (
    <Badge
      size="sm"
      variant={selected ? "filled" : "light"}
      style={onClick ? { cursor: "pointer" } : undefined}
      onClick={
        onClick
          ? () => {
              onClick(tag);
            }
          : undefined
      }
    >
      {tag}
      {count !== undefined && ` (${count})`}
    </Badge>
  );
}
