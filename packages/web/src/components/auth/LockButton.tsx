import { ActionIcon, Tooltip } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useVault } from "@/hooks/useVault";

export function LockButton() {
  const { status, lock } = useVault();
  const navigate = useNavigate();

  if (status !== "unlocked") {
    return null;
  }

  return (
    <Tooltip label="Lock vault (Shift+Cmd+L)" position="bottom">
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={() => {
          lock();
          void navigate({ to: "/unlock" });
        }}
        aria-label="Lock vault"
      >
        <IconLock size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
