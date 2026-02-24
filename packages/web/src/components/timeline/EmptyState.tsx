import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";

export function EmptyState() {
  const navigate = useNavigate();

  return (
    <Center py="xl">
      <Stack align="center" gap="md">
        <Title order={3} c="dimmed">
          No entries yet
        </Title>
        <Text size="sm" c="dimmed" maw={300} ta="center">
          Start writing your first journal entry. Your thoughts are encrypted
          and stored locally.
        </Text>
        <Button
          variant="light"
          onClick={() => {
            void navigate({ to: "/entry/new" });
          }}
        >
          New Entry
        </Button>
      </Stack>
    </Center>
  );
}
