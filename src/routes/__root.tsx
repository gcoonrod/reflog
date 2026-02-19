import { Outlet, createRootRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { VaultProvider, useVault } from "@/hooks/useVault";
import { useAutoLock } from "@/hooks/useAutoLock";
import { useKeyboard } from "@/hooks/useKeyboard";
import { SearchPalette } from "@/components/search/SearchPalette";
import { ReloadPrompt } from "@/components/common/ReloadPrompt";
import { StorageWarning } from "@/components/common/StorageWarning";
import { MultiTabWarning } from "@/components/common/MultiTabWarning";
import { theme } from "@/theme";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function AutoLockWatcher() {
  useAutoLock();
  return null;
}

function GlobalShortcuts() {
  const navigate = useNavigate();
  const { status } = useVault();

  const handleNewEntry = useCallback(() => {
    if (status === "unlocked") {
      void navigate({ to: "/entry/new" });
    }
  }, [status, navigate]);

  useKeyboard(
    {
      keys: "mod+n",
      handler: handleNewEntry,
      description: "Create new entry",
    },
    [handleNewEntry],
  );

  return null;
}

function RootComponent() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ErrorBoundary>
        <Notifications position="top-right" />
        <VaultProvider>
          <AutoLockWatcher />
          <GlobalShortcuts />
          <ErrorBoundary
            fallback={null}
          >
            <SearchPalette />
          </ErrorBoundary>
          <ReloadPrompt />
          <StorageWarning />
          <MultiTabWarning />
          <Outlet />
        </VaultProvider>
      </ErrorBoundary>
    </MantineProvider>
  );
}
