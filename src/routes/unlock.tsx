import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { UnlockScreen } from "@/components/vault/UnlockScreen";
import { useVault } from "@/hooks/useVault";

export const Route = createFileRoute("/unlock")({
  component: UnlockPage,
});

function UnlockPage() {
  const { status } = useVault();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unlocked") {
      void navigate({ to: "/" });
    }
  }, [status, navigate]);

  return <UnlockScreen />;
}
