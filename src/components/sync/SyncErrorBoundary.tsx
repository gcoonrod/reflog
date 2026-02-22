// T053b: Sync error boundary — catches sync failures and degrades gracefully
// to offline-only mode without crashing the app.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { notifications } from "@mantine/notifications";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SyncErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("SyncErrorBoundary caught:", error, info.componentStack);

    const message = error.message.toLowerCase();

    if (message.includes("quota")) {
      notifications.show({
        title: "Storage quota exceeded",
        message:
          "Your sync storage is full. Delete old entries or export data to free space.",
        color: "orange",
        autoClose: false,
      });
    } else if (message.includes("decrypt") || message.includes("encrypt")) {
      notifications.show({
        title: "Encryption error",
        message:
          "There was a problem with data encryption. Try locking and unlocking the vault.",
        color: "red",
        autoClose: false,
      });
    } else {
      notifications.show({
        title: "Sync error",
        message:
          "Sync encountered an error. The app will continue in offline mode.",
        color: "yellow",
        autoClose: 10000,
      });
    }
  }

  render(): ReactNode {
    // Always render children — sync errors should not block the UI.
    // The error boundary resets itself so the sync subsystem can retry.
    if (this.state.hasError) {
      this.setState({ hasError: false });
    }
    return this.props.children;
  }
}
