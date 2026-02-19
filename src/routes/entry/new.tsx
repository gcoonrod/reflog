import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  AppShell,
  Button,
  Container,
  Group,
  TextInput,
  Title,
  Modal,
  Text,
  Stack,
} from "@mantine/core";
import { EditorTabs } from "@/components/editor/EditorTabs";
import { TagInput } from "@/components/tags/TagInput";
import { useEntries } from "@/hooks/useEntries";
import { useKeyboard } from "@/hooks/useKeyboard";
import { extractFromBody, mergeTags } from "@/services/tags";
import { defaultEntryTitle } from "@/utils/date";

export const Route = createFileRoute("/entry/new")({
  component: NewEntryPage,
});

function NewEntryPage() {
  const navigate = useNavigate();
  const { create, getDraft, saveDraft, discardDraft, publishDraft } =
    useEntries();

  const [title, setTitle] = useState(defaultEntryTitle());
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    id: string;
    title: string;
    body: string;
    tags: string[];
  } | null>(null);

  const bodyRef = useRef(body);
  bodyRef.current = body;
  const titleRef = useRef(title);
  titleRef.current = title;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;

  // Check for existing draft on mount
  useEffect(() => {
    void getDraft().then((draft) => {
      if (draft) {
        setPendingDraft({ id: draft.id, title: draft.title, body: draft.body, tags: draft.tags });
        setShowDraftPrompt(true);
      }
    });
    // Run only on mount
  }, []);

  const handleResumeDraft = useCallback(() => {
    if (pendingDraft) {
      setTitle(pendingDraft.title);
      setBody(pendingDraft.body);
      setTags(pendingDraft.tags);
      setDraftId(pendingDraft.id);
    }
    setShowDraftPrompt(false);
    setPendingDraft(null);
  }, [pendingDraft]);

  const handleStartFresh = useCallback(() => {
    if (pendingDraft) {
      void discardDraft(pendingDraft.id);
    }
    setShowDraftPrompt(false);
    setPendingDraft(null);
  }, [pendingDraft, discardDraft]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const bodyTags = extractFromBody(body);
      const mergedTags = mergeTags(bodyTags, tags);
      if (draftId) {
        await saveDraft({ title, body, tags: mergedTags }, draftId);
        await publishDraft(draftId);
      } else {
        await create({ title, body, tags: mergedTags });
      }
      void navigate({ to: "/timeline" });
    } catch {
      setSaving(false);
    }
  }, [title, body, tags, draftId, create, saveDraft, publishDraft, navigate]);

  useKeyboard(
    {
      keys: "mod+enter",
      handler: () => {
        if (body.trim()) {
          void handleSave();
        }
      },
      description: "Save entry",
    },
    [handleSave, body],
  );

  // Auto-save as draft on unmount
  useEffect(() => {
    return () => {
      if (bodyRef.current.trim()) {
        void saveDraft(
          { title: titleRef.current, body: bodyRef.current, tags: tagsRef.current },
          draftIdRef.current ?? undefined,
        );
      }
    };
    // Run only on mount
  }, []);

  return (
    <>
      <Modal
        opened={showDraftPrompt}
        onClose={() => {
          setShowDraftPrompt(false);
        }}
        title="Existing Draft"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            You have an unsaved draft. Would you like to resume it or start
            fresh?
          </Text>
          <Group>
            <Button variant="light" onClick={handleResumeDraft}>
              Resume Draft
            </Button>
            <Button variant="subtle" onClick={handleStartFresh}>
              Start Fresh
            </Button>
          </Group>
        </Stack>
      </Modal>

      <AppShell header={{ height: 56 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Title order={4} ff="monospace">
              New Entry
            </Title>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  void navigate({ to: "/timeline" });
                }}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                loading={saving}
                disabled={!body.trim()}
                onClick={() => {
                  void handleSave();
                }}
              >
                Save
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          <Container size="sm">
            <Stack gap="md">
              <TextInput
                placeholder="Entry title"
                value={title}
                onChange={(e) => {
                  setTitle(e.currentTarget.value);
                }}
                size="lg"
                variant="unstyled"
                styles={{ input: { fontWeight: 600 } }}
              />
              <EditorTabs value={body} onChange={setBody} autoFocus />
              <TagInput tags={tags} onChange={setTags} />
            </Stack>
          </Container>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
