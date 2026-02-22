// T053a: Auth error boundary — catches authentication failures and provides
// user-friendly recovery options.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Center, Stack, Title, Text, Button, Group } from "@mantine/core";

interface Props {
  children: ReactNode;
  onLogout: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AuthErrorBoundary caught:", error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleLogout = (): void => {
    this.props.onLogout();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "An authentication error occurred.";

      return (
        <Center h="100vh">
          <Stack align="center" gap="md" maw={400}>
            <Title order={3}>Authentication Error</Title>
            <Text c="dimmed" size="sm" ta="center">
              {message}
            </Text>
            <Group>
              <Button variant="light" onClick={this.handleRetry}>
                Try again
              </Button>
              <Button
                variant="light"
                color="red"
                onClick={this.handleLogout}
              >
                Log out
              </Button>
            </Group>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}
