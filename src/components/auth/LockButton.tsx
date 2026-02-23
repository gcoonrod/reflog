import { ActionIcon, Tooltip } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useVault } from "@/hooks/useVault";

export function LockButton() {
  const { status, lock } = useVault();

  if (status !== "unlocked") {
    return null;
  }

  return (
    <Tooltip label="Lock vault (Shift+Cmd+L)" position="bottom">
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={lock}
        aria-label="Lock vault"
      >
        <IconLock size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
