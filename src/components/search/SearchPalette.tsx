import { Spotlight } from "@mantine/spotlight";
import { Group, Text, Badge } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useSearch } from "@/hooks/useSearch";
import { formatRelativeDate } from "@/utils/date";
import "@mantine/spotlight/styles.css";

export function SearchPalette() {
  const { query, setQuery, results, clearQuery } = useSearch();
  const navigate = useNavigate();

  const actions = results.map((result) => ({
    id: result.entryId,
    label: result.title,
    description: result.snippet,
    onClick() {
      clearQuery();
      void navigate({ to: "/entry/$id", params: { id: result.entryId } });
    },
    leftSection: (
      <Text size="xs" c="dimmed">
        {formatRelativeDate(result.createdAt)}
      </Text>
    ),
    rightSection:
      result.tags.length > 0 ? (
        <Group gap={4}>
          {result.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} size="xs" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      ) : null,
  }));

  return (
    <Spotlight
      actions={actions}
      query={query}
      onQueryChange={setQuery}
      nothingFound="No matching entries"
      highlightQuery
      shortcut={["mod + K"]}
      searchProps={{ placeholder: "Search entries..." }}
    />
  );
}
