import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { notifications } from "@mantine/notifications";
import { Anchor, Group, Text } from "@mantine/core";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { SyncErrorBoundary } from "@/components/sync/SyncErrorBoundary";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { InviteGate } from "@/components/auth/InviteGate";
import { VaultProvider, useVault } from "@/hooks/useVault";
import { useAuth } from "@/hooks/useAuth";
import { useAutoLock } from "@/hooks/useAutoLock";
import { useKeyboard } from "@/hooks/useKeyboard";
import { SearchPalette } from "@/components/search/SearchPalette";
import { ReloadPrompt } from "@/components/common/ReloadPrompt";
import { StorageWarning } from "@/components/common/StorageWarning";
import { MultiTabWarning } from "@/components/common/MultiTabWarning";
import { onSyncEvent } from "@/services/sync";
import * as syncScheduler from "@/services/syncScheduler";
import * as syncCoordinator from "@/services/syncCoordinator";
import { getEncryptionKey } from "@/db";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AutoLockWatcher() {
  useAutoLock();
  return null;
}

function GlobalShortcuts() {
  const navigate = useNavigate();
  const { status, lock } = useVault();

  const handleNewEntry = useCallback(() => {
    if (status === "unlocked") {
      void navigate({ to: "/entry/new" });
    }
  }, [status, navigate]);

  const handleLock = useCallback(() => {
    if (status === "unlocked") {
      lock();
      void navigate({ to: "/unlock" });
    }
  }, [status, lock, navigate]);

  useKeyboard(
    {
      keys: "mod+n",
      handler: handleNewEntry,
      description: "Create new entry",
    },
    [handleNewEntry],
  );

  useKeyboard(
    {
      keys: "shift+mod+l",
      handler: handleLock,
      description: "Lock vault",
      preventDefault: true,
    },
    [handleLock],
  );

  return null;
}

// T042: Conflict notification via Mantine notifications
function SyncConflictNotifier() {
  useEffect(() => {
    return onSyncEvent((event) => {
      if (event.type === "conflict-resolved" && event.detail) {
        const rawTitle = event.detail.conflictTitle;
        const title = typeof rawTitle === "string" ? rawTitle : "Unknown entry";
        if (event.detail.conflictType === "deleted") {
          notifications.show({
            title: "Sync conflict resolved",
            message: `Entry "${title}" was deleted on another device but your recent edit was preserved.`,
            color: "yellow",
          });
        } else {
          notifications.show({
            title: "Entry updated",
            message: `Entry "${title}" was updated from another device.`,
            color: "blue",
          });
        }
      }
    });
  }, []);

  return null;
}

// T043: Initialize sync engine on vault unlock
function SyncLifecycle() {
  const { status } = useVault();
  const { getToken } = useAuth();
  const syncStartedRef = useRef(false);

  useEffect(() => {
    if (status !== "unlocked") {
      if (syncStartedRef.current) {
        syncScheduler.stop();
        syncCoordinator.stop();
        syncStartedRef.current = false;
      }
      return;
    }

    const cryptoKey = getEncryptionKey();
    if (!cryptoKey) return;

    syncCoordinator.start({
      onBecomeLeader: () => {
        syncScheduler.start(getToken, cryptoKey);
        syncStartedRef.current = true;
      },
      onSyncRequested: () => {
        syncScheduler.requestSync();
      },
      onRemoteSyncComplete: () => {
        // Non-leader tabs could refresh UI here if needed
      },
    });

    return () => {
      syncScheduler.stop();
      syncCoordinator.stop();
      syncStartedRef.current = false;
    };
  }, [status, getToken]);

  return null;
}

function AppFooter() {
  return (
    <Group justify="center" py="sm" mt="auto" gap="xs">
      <Anchor component={Link} to="/terms" size="xs" c="dimmed">
        Terms
      </Anchor>
      <Text size="xs" c="dimmed">
        |
      </Text>
      <Anchor component={Link} to="/privacy" size="xs" c="dimmed">
        Privacy
      </Anchor>
    </Group>
  );
}

function AppLayout() {
  return (
    <AuthGuard>
      <InviteGate>
        <VaultProvider>
          <AutoLockWatcher />
          <GlobalShortcuts />
          <SyncErrorBoundary>
            <SyncConflictNotifier />
            <SyncLifecycle />
          </SyncErrorBoundary>
          <ErrorBoundary fallback={null}>
            <SearchPalette />
          </ErrorBoundary>
          <ReloadPrompt />
          <StorageWarning>
            <MultiTabWarning />
            <Outlet />
          </StorageWarning>
          <AppFooter />
        </VaultProvider>
      </InviteGate>
    </AuthGuard>
  );
}
