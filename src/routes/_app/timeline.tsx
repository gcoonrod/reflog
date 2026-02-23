import { createFileRoute } from "@tanstack/react-router";
import {
  AppShell,
  Container,
  Group,
  Stack,
  Title,
  Button,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useEntries } from "@/hooks/useEntries";
import { useTags } from "@/hooks/useTags";
import { EntryList } from "@/components/timeline/EntryList";
import { EmptyState } from "@/components/timeline/EmptyState";
import { TagFilterBar } from "@/components/tags/TagFilterBar";

export const Route = createFileRoute("/_app/timeline")({
  component: TimelinePage,
});

function TimelinePage() {
  const { allTags, selectedTags, toggleTag, clearTags } = useTags();
  const { entries, isLoading } = useEntries({
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });
  const navigate = useNavigate();

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4} ff="monospace">
            Reflog
          </Title>
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              void navigate({ to: "/entry/new" });
            }}
          >
            New Entry
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm">
          <Stack gap="md">
            <TagFilterBar
              allTags={allTags}
              selectedTags={selectedTags}
              onToggle={toggleTag}
              onClear={clearTags}
            />
            {!isLoading && entries.length === 0 ? (
              <EmptyState />
            ) : (
              <EntryList entries={entries} />
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
