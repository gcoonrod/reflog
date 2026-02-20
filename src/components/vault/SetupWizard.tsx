import { useState } from "react";
import {
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
  Alert,
} from "@mantine/core";
import { useVault } from "@/hooks/useVault";

const MIN_PASSPHRASE_LENGTH = 8;

export function SetupWizard() {
  const { setup } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid =
    passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase === confirm;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
      return;
    }

    if (passphrase !== confirm) {
      setError("Passphrases do not match");
      return;
    }

    setLoading(true);
    try {
      await setup(passphrase);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create vault",
      );
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
              Create Your Vault
            </Title>

            <Text size="sm" c="dimmed" ta="center">
              Choose a passphrase to encrypt your journal. This passphrase
              cannot be recovered — if you forget it, your data will be
              permanently inaccessible.
            </Text>

            <Alert color="yellow" variant="light">
              <Text size="xs">
                There is no password recovery. Write down your passphrase
                somewhere safe.
              </Text>
            </Alert>

            <PasswordInput
              label="Passphrase"
              placeholder="Enter passphrase (min 8 characters)"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.currentTarget.value);
              }}
              error={
                passphrase.length > 0 &&
                passphrase.length < MIN_PASSPHRASE_LENGTH
                  ? `Min ${MIN_PASSPHRASE_LENGTH} characters`
                  : undefined
              }
              autoFocus
            />

            <PasswordInput
              label="Confirm Passphrase"
              placeholder="Re-enter passphrase"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.currentTarget.value);
              }}
              error={
                confirm.length > 0 && passphrase !== confirm
                  ? "Does not match"
                  : undefined
              }
            />

            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}

            <Button
              type="submit"
              fullWidth
              disabled={!isValid}
              loading={loading}
            >
              Create Vault
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
    </main>
  );
}
