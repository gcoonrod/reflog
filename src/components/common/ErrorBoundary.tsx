import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Center, Stack, Text, Title } from "@mantine/core";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Center h="100vh">
          <Stack align="center" gap="md">
            <Title order={3}>Something went wrong</Title>
            <Text c="dimmed" size="sm" maw={400} ta="center">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </Text>
            <Button variant="light" onClick={this.handleReload}>
              Reload App
            </Button>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}
