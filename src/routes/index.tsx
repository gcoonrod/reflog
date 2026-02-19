import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Center, Loader } from "@mantine/core";
import { useVault } from "@/hooks/useVault";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { status } = useVault();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "no-vault") {
      void navigate({ to: "/setup" });
    } else if (status === "locked") {
      void navigate({ to: "/unlock" });
    } else if (status === "unlocked") {
      void navigate({ to: "/timeline" });
    }
  }, [status, navigate]);

  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}
