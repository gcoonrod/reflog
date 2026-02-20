import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  useNavigate,
  Link,
} from "@tanstack/react-router";
import { useCallback } from "react";
import {
  MantineProvider,
  ColorSchemeScript,
  Container,
  Title,
  Text,
  Button,
} from "@mantine/core";
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

function NotFoundComponent() {
  return (
    <Container size="xs" py="xl" ta="center">
      <Title order={1} ff="monospace">
        404
      </Title>
      <Text c="dimmed" mt="sm">
        Page not found.
      </Text>
      <Button component={Link} to="/" mt="lg" variant="light">
        Back to home
      </Button>
    </Container>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
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
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#1a1b1e" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <ColorSchemeScript defaultColorScheme="dark" />
        <HeadContent />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <ErrorBoundary>
            <Notifications position="top-right" />
            <VaultProvider>
              <AutoLockWatcher />
              <GlobalShortcuts />
              <ErrorBoundary fallback={null}>
                <SearchPalette />
              </ErrorBoundary>
              <ReloadPrompt />
              <StorageWarning>
                <MultiTabWarning />
                <Outlet />
              </StorageWarning>
            </VaultProvider>
          </ErrorBoundary>
        </MantineProvider>
        <Scripts />
      </body>
    </html>
  );
}
