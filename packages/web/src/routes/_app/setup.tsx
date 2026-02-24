import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SetupWizard } from "@/components/vault/SetupWizard";
import { useVault } from "@/hooks/useVault";

export const Route = createFileRoute("/_app/setup")({
  component: SetupPage,
});

function SetupPage() {
  const { status } = useVault();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unlocked") {
      void navigate({ to: "/" });
    }
  }, [status, navigate]);

  return <SetupWizard />;
}
