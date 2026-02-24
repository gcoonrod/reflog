import { useEffect, useState, useMemo } from "react";
import { Notification, Text } from "@mantine/core";
import { StorageUsageContext } from "@/hooks/useStorageUsage";
import type { StorageUsageContextValue } from "@/hooks/useStorageUsage";

const WARN_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;
const CHECK_INTERVAL_MS = 60_000;

/**
 * Provides storage usage context to the component tree and renders
 * a warning banner when usage exceeds 80%.
 */
export function StorageWarning({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkStorage() {
      if (!("storage" in navigator)) return;
      const { usage: used, quota } = await navigator.storage.estimate();
      if (used !== undefined && quota !== undefined && quota > 0) {
        setUsage(used / quota);
      }
    }

    void checkStorage();
    const interval = setInterval(() => {
      void checkStorage();
    }, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const ctxValue = useMemo<StorageUsageContextValue>(
    () => ({
      usage,
      isCritical: usage !== null && usage >= CRITICAL_THRESHOLD,
    }),
    [usage],
  );

  const showWarning = usage !== null && usage >= WARN_THRESHOLD && !dismissed;
  const percent = usage !== null ? Math.round(usage * 100) : 0;

  return (
    <StorageUsageContext.Provider value={ctxValue}>
      {children}
      {showWarning && (
        <Notification
          color={ctxValue.isCritical ? "red" : "orange"}
          withBorder
          withCloseButton
          closeButtonProps={{ "aria-label": "Dismiss warning" }}
          onClose={() => {
            setDismissed(true);
          }}
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            zIndex: 1000,
            maxWidth: 360,
          }}
        >
          <Text size="sm">
            Storage is {percent}% full.
            {ctxValue.isCritical
              ? " Saving is disabled. Free space to continue."
              : " Consider freeing space soon."}
          </Text>
        </Notification>
      )}
    </StorageUsageContext.Provider>
  );
}
