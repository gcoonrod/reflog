import { Group } from "@mantine/core";
import { useVault } from "@/hooks/useVault";
import { SyncIndicator } from "@/components/sync/SyncIndicator";
import { LockButton } from "@/components/auth/LockButton";
import { AccountMenu } from "@/components/auth/AccountMenu";

export function AppHeaderActions() {
  const { status } = useVault();

  if (status !== "unlocked") {
    return null;
  }

  return (
    <Group gap="xs">
      <SyncIndicator />
      <LockButton />
      <AccountMenu />
    </Group>
  );
}
