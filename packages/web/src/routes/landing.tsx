import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Center,
  Stack,
  Title,
  Text,
  Button,
  Container,
  TextInput,
  Checkbox,
  Group,
  Anchor,
  Alert,
} from "@mantine/core";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/landing")({
  component: LandingPage,
});

function LandingPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "added" | "exists" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleWaitlistSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!email || !consent) return;

    setStatus("submitting");
    try {
      const apiUrl = import.meta.env.VITE_SYNC_API_URL as string;
      const response = await fetch(`${apiUrl}/api/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          consent: true,
        }),
      });

      const data = (await response.json()) as {
        status?: string;
        error?: string;
        message?: string;
      };

      if (response.status === 201) {
        setStatus("added");
      } else if (response.status === 409) {
        setStatus("exists");
      } else {
        setStatus("error");
        setErrorMessage(data.message ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the server. Please try again later.");
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Container size="xs">
        <Stack align="center" gap="xl">
          <Stack align="center" gap="xs">
            <Title order={1} ff="monospace" ta="center">
              Reflog
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Privacy-first developer journal.
              <br />
              Encrypted, offline-first, keyboard-driven.
            </Text>
          </Stack>

          <Alert variant="light" color="blue" w="100%">
            <Text size="sm" ta="center">
              Reflog is currently in <strong>invite-only beta</strong>.
              <br />
              Already have an invite? Sign in below.
            </Text>
          </Alert>

          <Button onClick={login} size="md" variant="filled" fullWidth>
            Sign in with invite
          </Button>

          <Stack gap="xs" w="100%">
            <Text size="sm" fw={600} ta="center">
              No invite? Join the waitlist
            </Text>

            {status === "added" ? (
              <Alert color="green" variant="light">
                <Text size="sm" ta="center">
                  You&apos;ve been added to the waitlist! We&apos;ll send an
                  invite when a spot opens up.
                </Text>
              </Alert>
            ) : status === "exists" ? (
              <Alert color="yellow" variant="light">
                <Text size="sm" ta="center">
                  This email is already on the waitlist.
                </Text>
              </Alert>
            ) : (
              <form onSubmit={(e) => void handleWaitlistSubmit(e)}>
                <Stack gap="sm">
                  <TextInput
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.currentTarget.value);
                    }}
                    required
                  />
                  <Checkbox
                    size="xs"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.currentTarget.checked);
                    }}
                    label={
                      <>
                        I agree to the{" "}
                        <Anchor component={Link} to="/privacy" size="xs">
                          Privacy Policy
                        </Anchor>
                      </>
                    }
                    required
                  />
                  {status === "error" && (
                    <Text size="xs" c="red">
                      {errorMessage}
                    </Text>
                  )}
                  <Button
                    type="submit"
                    variant="light"
                    fullWidth
                    disabled={!email || !consent}
                    loading={status === "submitting"}
                  >
                    Join waitlist
                  </Button>
                </Stack>
              </form>
            )}
          </Stack>

          <Group gap="sm">
            <Anchor component={Link} to="/terms" size="xs" c="dimmed">
              Terms of Service
            </Anchor>
            <Text size="xs" c="dimmed">
              |
            </Text>
            <Anchor component={Link} to="/privacy" size="xs" c="dimmed">
              Privacy Policy
            </Anchor>
          </Group>
        </Stack>
      </Container>
    </Center>
  );
}
