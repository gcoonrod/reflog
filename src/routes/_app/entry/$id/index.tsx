import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AppShell,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { useEntry } from "@/hooks/useEntries";
import * as entryService from "@/services/entries";
import { formatRelativeDate } from "@/utils/date";

export const Route = createFileRoute("/_app/entry/$id/")({
  component: ViewEntryPage,
});

function ViewEntryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { entry, isLoading } = useEntry(id);
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) {
    return null;
  }

  if (!entry) {
    return (
      <AppShell header={{ height: 56 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md">
            <Title order={4} ff="monospace">
              Entry Not Found
            </Title>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <Container size="sm">
            <Text c="dimmed">This entry does not exist.</Text>
          </Container>
        </AppShell.Main>
      </AppShell>
    );
  }

  const isEdited = entry.updatedAt !== entry.createdAt;

  return (
    <>
      <Modal
        opened={showDelete}
        onClose={() => {
          setShowDelete(false);
        }}
        title="Delete Entry"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to permanently delete this entry? This cannot
            be undone.
          </Text>
          <Group>
            <Button
              color="red"
              onClick={() => {
                void entryService.remove(id).then(() => {
                  void navigate({ to: "/timeline" });
                });
              }}
            >
              Delete
            </Button>
            <Button
              variant="subtle"
              onClick={() => {
                setShowDelete(false);
              }}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>

      <AppShell header={{ height: 56 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                void navigate({ to: "/timeline" });
              }}
            >
              Back
            </Button>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  void navigate({
                    to: "/entry/$id/edit",
                    params: { id },
                  });
                }}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => {
                  setShowDelete(true);
                }}
              >
                Delete
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          <Container size="sm">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>{typeof entry.title === "string" ? entry.title : ""}</Title>
                <Group gap="xs">
                  {isEdited && (
                    <Badge size="sm" variant="light" color="gray">
                      edited
                    </Badge>
                  )}
                  <Text size="sm" c="dimmed">
                    {formatRelativeDate(entry.createdAt)}
                  </Text>
                </Group>
              </Group>

              {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                <Group gap={4}>
                  {entry.tags.map((tag) => (
                    <Badge key={tag} size="sm" variant="light">
                      {tag}
                    </Badge>
                  ))}
                </Group>
              )}

              <MarkdownPreview content={typeof entry.body === "string" ? entry.body : ""} />
            </Stack>
          </Container>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
