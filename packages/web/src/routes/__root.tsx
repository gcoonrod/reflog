import { lazy, Suspense } from "react";
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  Link,
} from "@tanstack/react-router";
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
import { AuthErrorBoundary } from "@/components/auth/AuthErrorBoundary";
import { theme, cssResolver } from "@/theme";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

// Lazy-load Auth0Provider to avoid SSR prerender failure
// (@auth0/auth0-spa-js references `self` at module evaluation time)
const Auth0ProviderClient = lazy(
  () => import("@/components/auth/Auth0ProviderClient"),
);

function NotFoundComponent() {
  return (
    <main>
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
    </main>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#1a1b1e" />
        <meta
          name="description"
          content="Privacy-first developer journal. Encrypted, offline-first, keyboard-driven."
        />
        <title>Reflog</title>
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <ColorSchemeScript defaultColorScheme="dark" />
        <HeadContent />
      </head>
      <body>
        <Suspense fallback={null}>
          <Auth0ProviderClient>
            <MantineProvider
              theme={theme}
              defaultColorScheme="dark"
              cssVariablesResolver={cssResolver}
            >
              <AuthErrorBoundary
                onLogout={() => {
                  window.location.href = "/login";
                }}
              >
                <ErrorBoundary>
                  <Notifications position="top-right" />
                  <Outlet />
                </ErrorBoundary>
              </AuthErrorBoundary>
            </MantineProvider>
          </Auth0ProviderClient>
        </Suspense>
        <Scripts />
      </body>
    </html>
  );
}
