// T040: Sync indicator — subtle icon in header showing sync state
import { ActionIcon, Tooltip, Loader } from "@mantine/core";
import {
  IconCloudCheck,
  IconCloudOff,
  IconAlertTriangle,
  IconCloudDownload,
  IconRefresh,
} from "@tabler/icons-react";
import { useSyncStatus, type SyncState } from "@/hooks/useSyncStatus";

const stateConfig: Record<
  SyncState,
  { icon: typeof IconCloudCheck; color: string; label: string }
> = {
  synced: { icon: IconCloudCheck, color: "green", label: "Synced" },
  syncing: { icon: IconRefresh, color: "blue", label: "Syncing..." },
  offline: { icon: IconCloudOff, color: "gray", label: "Offline" },
  error: { icon: IconAlertTriangle, color: "red", label: "Sync error" },
  "initial-sync": {
    icon: IconCloudDownload,
    color: "blue",
    label: "Initial sync...",
  },
};

export function SyncIndicator() {
  const { state, lastSyncAt, error, initialSyncProgress } = useSyncStatus();
  const config = stateConfig[state];

  let tooltipLabel = config.label;
  if (state === "synced" && lastSyncAt) {
    const date = new Date(lastSyncAt);
    tooltipLabel = `Synced at ${date.toLocaleTimeString()}`;
  } else if (state === "error" && error) {
    tooltipLabel = `Sync error: ${error}`;
  } else if (state === "initial-sync" && initialSyncProgress !== null) {
    tooltipLabel = `Downloading entries... (${initialSyncProgress})`;
  }

  const Icon = config.icon;

  return (
    <Tooltip label={tooltipLabel} position="bottom">
      <ActionIcon
        variant="subtle"
        size="lg"
        color={config.color}
        aria-label={config.label}
        style={{ cursor: "default" }}
      >
        {state === "syncing" ? <Loader size={16} /> : <Icon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
