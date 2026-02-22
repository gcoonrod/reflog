// T048: Migration route — displayed when an authenticated user has an existing
// local vault but no sync_meta.deviceId (first launch after upgrade from MVP).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Center,
  Stack,
  Title,
  Text,
  Button,
  Progress,
  Alert,
} from "@mantine/core";
import { IconCloudUpload, IconAlertTriangle } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { registerDeviceIfNeeded } from "@/services/auth";
import { push } from "@/services/sync";
import { getEncryptionKey } from "@/db";

export const Route = createFileRoute("/_app/migrate")({
  component: MigratePage,
});

function MigratePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);

    try {
      setProgress(20);
      await registerDeviceIfNeeded(getToken);

      setProgress(50);
      const cryptoKey = getEncryptionKey();
      if (!cryptoKey) {
        throw new Error("Vault must be unlocked to migrate");
      }

      // Push all local data to server
      await push(getToken, cryptoKey);

      setProgress(100);
      void navigate({ to: "/timeline" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Migration failed. Please retry.";
      setError(message);
      setMigrating(false);
    }
  };

  return (
    <Center h="100vh">
      <Stack align="center" gap="lg" maw={400} px="md">
        <IconCloudUpload size={48} stroke={1.5} />
        <Title order={2} ta="center">
          Sync Your Data
        </Title>
        <Text c="dimmed" ta="center" size="sm">
          Your existing journal entries are stored locally on this device. Enable
          sync to access them from all your devices with end-to-end encryption.
        </Text>

        {error && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            title="Migration error"
            w="100%"
          >
            {error}
          </Alert>
        )}

        {migrating && <Progress value={progress} w="100%" animated />}

        <Button
          onClick={() => void handleMigrate()}
          loading={migrating}
          leftSection={<IconCloudUpload size={16} />}
          fullWidth
        >
          {migrating ? "Migrating..." : "Enable Sync"}
        </Button>
      </Stack>
    </Center>
  );
}
