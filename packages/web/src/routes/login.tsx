import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Center, Stack, Title, Text, Button, Container } from "@mantine/core";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: "/" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return null;
  }

  return (
    <Center h="100vh">
      <Container size="xs">
        <Stack align="center" gap="lg">
          <Title order={1} ff="monospace" ta="center">
            Reflog
          </Title>
          <Text c="dimmed" ta="center" size="sm">
            Privacy-first developer journal.
            <br />
            Encrypted, offline-first, keyboard-driven.
          </Text>
          <Button onClick={login} size="md" variant="filled" fullWidth>
            Sign in
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
