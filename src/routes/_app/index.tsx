import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Center, Loader } from "@mantine/core";
import { useVault } from "@/hooks/useVault";
import db from "@/db";

export const Route = createFileRoute("/_app/")({
  component: IndexPage,
});

function IndexPage() {
  const { status } = useVault();
  const navigate = useNavigate();
  const [needsMigration, setNeedsMigration] = useState<boolean | null>(null);

  // T049: Check if migration is needed (existing vault but no deviceId)
  useEffect(() => {
    if (status !== "unlocked") return;

    void db.sync_meta.get("deviceId").then((meta) => {
      setNeedsMigration(!meta);
    });
  }, [status]);

  useEffect(() => {
    if (status === "no-vault") {
      void navigate({ to: "/setup" });
    } else if (status === "locked") {
      void navigate({ to: "/unlock" });
    } else if (status === "unlocked") {
      if (needsMigration === null) return; // Still checking
      if (needsMigration) {
        void navigate({ to: "/migrate" });
      } else {
        void navigate({ to: "/timeline" });
      }
    }
  }, [status, needsMigration, navigate]);

  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}
