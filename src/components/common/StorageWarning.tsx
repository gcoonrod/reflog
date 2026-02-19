import { useEffect, useState } from "react";
import { Notification, Text } from "@mantine/core";

const WARN_THRESHOLD = 0.8;
const CHECK_INTERVAL_MS = 60_000;

export function StorageWarning() {
  const [usage, setUsage] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkStorage() {
      if (!("storage" in navigator)) return;
      const { usage: used, quota } = await navigator.storage.estimate();
      if (used !== undefined && quota !== undefined && quota > 0) {
        setUsage(used / quota);
      }
    }

    void checkStorage();
    const interval = setInterval(() => { void checkStorage(); }, CHECK_INTERVAL_MS);
    return () => { clearInterval(interval); };
  }, []);

  if (usage === null || usage < WARN_THRESHOLD || dismissed) return null;

  const percent = Math.round(usage * 100);

  return (
    <Notification
      color="orange"
      withBorder
      withCloseButton
      onClose={() => { setDismissed(true); }}
      style={{ position: "fixed", bottom: 16, left: 16, zIndex: 1000, maxWidth: 360 }}
    >
      <Text size="sm">
        Storage is {percent}% full.
        {usage >= 0.95
          ? " Free space to continue saving entries."
          : " Consider freeing space soon."}
      </Text>
    </Notification>
  );
}
