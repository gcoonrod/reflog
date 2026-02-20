import { Badge, Card, Group, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { formatRelativeDate } from "@/utils/date";
import type { Entry } from "@/types";

interface EntryCardProps {
  entry: Entry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const navigate = useNavigate();
  const isEdited = entry.updatedAt !== entry.createdAt;

  // Create a preview snippet from the body (first ~120 chars, stripped of markdown)
  const snippet = entry.body
    .replace(/[#*_~`>\[\]()!]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 120);

  return (
    <Card
      withBorder
      padding="md"
      data-testid="entry-card"
      style={{ cursor: "pointer" }}
      onClick={() => {
        void navigate({ to: "/entry/$id", params: { id: entry.id } });
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={600} lineClamp={1} style={{ flex: 1 }}>
          {entry.title}
        </Text>
        <Group gap="xs" wrap="nowrap">
          {isEdited && (
            <Badge size="xs" variant="light" color="gray">
              edited
            </Badge>
          )}
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {formatRelativeDate(entry.createdAt)}
          </Text>
        </Group>
      </Group>

      {snippet && (
        <Text size="sm" c="dimmed" lineClamp={2} mb="xs">
          {snippet}
        </Text>
      )}

      {entry.tags.length > 0 && (
        <Group gap={4}>
          {entry.tags.map((tag) => (
            <Badge key={tag} size="xs" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      )}
    </Card>
  );
}
