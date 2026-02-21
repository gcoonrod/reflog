import { useEffect, useState } from "react";
import { Notification, Text } from "@mantine/core";

const CHANNEL_NAME = "reflog-tab-sync";

export function MultiTabWarning() {
  const [otherTabDetected, setOtherTabDetected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL_NAME);

    // Announce this tab
    channel.postMessage({ type: "tab-open" });

    channel.onmessage = (e: MessageEvent<{ type: string }>) => {
      if (e.data.type === "tab-open") {
        setOtherTabDetected(true);
        // Respond so the other tab also knows
        channel.postMessage({ type: "tab-ack" });
      } else if (e.data.type === "tab-ack") {
        setOtherTabDetected(true);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  if (!otherTabDetected || dismissed) return null;

  return (
    <Notification
      color="yellow"
      withBorder
      withCloseButton
      closeButtonProps={{ "aria-label": "Dismiss warning" }}
      onClose={() => { setDismissed(true); }}
      style={{ position: "fixed", bottom: 80, left: 16, zIndex: 1000, maxWidth: 360 }}
    >
      <Text size="sm">
        Reflog is open in another tab. Changes may not sync until you reload.
      </Text>
    </Notification>
  );
}
