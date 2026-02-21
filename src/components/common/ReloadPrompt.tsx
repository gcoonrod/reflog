import { useRegisterSW } from "virtual:pwa-register/react";
import { Notification, Button, Group, Text } from "@mantine/core";

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <Notification
      withBorder
      withCloseButton
      closeButtonProps={{ "aria-label": "Dismiss notification" }}
      onClose={() => {
        setOfflineReady(false);
        setNeedRefresh(false);
      }}
      style={{ position: "fixed", bottom: 16, right: 16, zIndex: 1000, maxWidth: 360 }}
    >
      {offlineReady && (
        <Text size="sm">App is ready for offline use.</Text>
      )}
      {needRefresh && (
        <Group gap="xs">
          <Text size="sm">A new version is available.</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => { void updateServiceWorker(); }}
          >
            Reload
          </Button>
        </Group>
      )}
    </Notification>
  );
}
