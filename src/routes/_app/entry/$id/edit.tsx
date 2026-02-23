import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  AppShell,
  Button,
  Container,
  Group,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { EditorTabs } from "@/components/editor/EditorTabs";
import { TagInput } from "@/components/tags/TagInput";
import { useEntry } from "@/hooks/useEntries";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import * as entryService from "@/services/entries";
import { extractFromBody, mergeTags } from "@/services/tags";
import { AppHeaderActions } from "@/components/layout/AppHeaderActions";

export const Route = createFileRoute("/_app/entry/$id/edit")({
  component: EditEntryPage,
});

function EditEntryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { entry, isLoading } = useEntry(id);
  const { isCritical: storageCritical } = useStorageUsage();

  const [title, setTitle] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Use local state if user has edited, otherwise use the entry data
  const currentTitle = title ?? entry?.title ?? "";
  const currentBody = body ?? entry?.body ?? "";
  const currentTags = tags ?? entry?.tags ?? [];

  const handleSave = useCallback(async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const bodyTags = extractFromBody(currentBody);
      const mergedTags = mergeTags(bodyTags, currentTags);
      await entryService.update(id, {
        title: currentTitle,
        body: currentBody,
        tags: mergedTags,
      });
      void navigate({ to: "/entry/$id", params: { id } });
    } catch {
      setSaving(false);
    }
  }, [id, entry, currentTitle, currentBody, currentTags, navigate]);

  useKeyboard(
    {
      keys: "mod+enter",
      handler: () => {
        if (currentBody.trim()) {
          void handleSave();
        }
      },
      description: "Save entry",
    },
    [handleSave, currentBody],
  );

  if (isLoading || !entry) {
    return null;
  }

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4} ff="monospace">
            Edit Entry
          </Title>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                void navigate({ to: "/entry/$id", params: { id } });
              }}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              loading={saving}
              disabled={!currentBody.trim() || storageCritical}
              onClick={() => {
                void handleSave();
              }}
            >
              Save
            </Button>
            <AppHeaderActions />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm">
          <Stack gap="md">
            <TextInput
              placeholder="Entry title"
              value={currentTitle}
              onChange={(e) => {
                setTitle(e.currentTarget.value);
              }}
              size="lg"
              variant="unstyled"
              styles={{ input: { fontWeight: 600 } }}
            />
            <EditorTabs value={currentBody} onChange={setBody} autoFocus />
            <TagInput tags={currentTags} onChange={setTags} />
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
