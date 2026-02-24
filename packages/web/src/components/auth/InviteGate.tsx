import { useEffect, useState, type ReactNode } from "react";
import {
  Center,
  Stack,
  Title,
  Text,
  Button,
  Loader,
  Container,
  Alert,
} from "@mantine/core";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";

const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === "true";

type GateStatus =
  | "checking"
  | "valid"
  | "invite_required"
  | "beta_full"
  | "error";

interface InviteGateProps {
  children: ReactNode;
}

export function InviteGate({ children }: InviteGateProps) {
  // In E2E test builds, skip invite verification — no sync API running
  if (AUTH_DISABLED) {
    return <>{children}</>;
  }

  return <InviteGateInner>{children}</InviteGateInner>;
}

function InviteGateInner({ children }: InviteGateProps) {
  const { user, getToken } = useAuth();
  const [status, setStatus] = useState<GateStatus>("checking");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    let cancelled = false;
    const checkInvite = async () => {
      try {
        const token = await getToken();
        const apiUrl = import.meta.env.VITE_SYNC_API_URL as string;
        const response = await fetch(`${apiUrl}/api/v1/invites/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: user.email }),
        });

        if (cancelled) return;

        if (response.ok) {
          // On first successful verification, consume the invite
          await fetch(`${apiUrl}/api/v1/invites/consume`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email: user.email }),
          });
          setStatus("valid");
        } else if (response.status === 403) {
          const data = (await response.json()) as { error?: string };
          if (data.error === "beta_full") {
            setStatus("beta_full");
          } else {
            setStatus("invite_required");
          }
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void checkInvite();
    return () => {
      cancelled = true;
    };
  }, [user?.email, getToken, retryCount]);

  if (status === "checking") {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (status === "valid") {
    return <>{children}</>;
  }

  if (status === "invite_required") {
    return (
      <Center h="100vh" p="md">
        <Container size="xs">
          <Stack align="center" gap="lg">
            <Title order={2} ta="center">
              Invite Required
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Reflog is currently in invite-only beta. You need a valid invite
              to access the app.
            </Text>
            <Alert variant="light" color="blue" w="100%">
              <Text size="sm" ta="center">
                If you believe you should have access, check your email for an
                invite or contact the operator.
              </Text>
            </Alert>
            <Button component={Link} to="/landing" variant="light" fullWidth>
              Join the waitlist
            </Button>
          </Stack>
        </Container>
      </Center>
    );
  }

  if (status === "beta_full") {
    return (
      <Center h="100vh" p="md">
        <Container size="xs">
          <Stack align="center" gap="lg">
            <Title order={2} ta="center">
              Beta at Capacity
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              The Reflog beta is currently at capacity. We&apos;ll send you an
              invite when a spot opens up.
            </Text>
            <Button component={Link} to="/landing" variant="light" fullWidth>
              Join the waitlist
            </Button>
          </Stack>
        </Container>
      </Center>
    );
  }

  // Error state
  return (
    <Center h="100vh" p="md">
      <Container size="xs">
        <Stack align="center" gap="lg">
          <Title order={2} ta="center">
            Something went wrong
          </Title>
          <Text c="dimmed" ta="center" size="sm">
            We couldn&apos;t verify your invite status. Please try again later.
          </Text>
          <Button
            onClick={() => {
              setStatus("checking");
              setRetryCount((c) => c + 1);
            }}
            variant="light"
            fullWidth
          >
            Retry
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
