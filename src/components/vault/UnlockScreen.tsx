import { useState } from "react";
import {
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useVault } from "@/hooks/useVault";

export function UnlockScreen() {
  const { unlock } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!passphrase) return;

    setLoading(true);
    try {
      await unlock(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock vault");
      setLoading(false);
    }
  }

  return (
    <main>
      <Center h="100vh">
        <Paper p="xl" w={400} withBorder>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            <Stack gap="md">
              <Title order={2} ta="center">
                Unlock Reflog
              </Title>

              <Text size="sm" c="dimmed" ta="center">
                Enter your passphrase to unlock your journal.
              </Text>

              <PasswordInput
                label="Passphrase"
                placeholder="Enter your passphrase"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.currentTarget.value);
                }}
                autoFocus
              />

              {error && (
                <Text size="sm" c="red">
                  {error}
                </Text>
              )}

              <Button
                type="submit"
                fullWidth
                disabled={!passphrase}
                loading={loading}
              >
                Unlock
              </Button>
            </Stack>
          </form>
        </Paper>
      </Center>
    </main>
  );
}
