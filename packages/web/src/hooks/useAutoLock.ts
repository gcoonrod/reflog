import { useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as autoLock from "@/services/autoLock";
import { useVault } from "@/hooks/useVault";

export function useAutoLock() {
  const { status, lock } = useVault();
  const navigate = useNavigate();

  const handleLock = useCallback(() => {
    lock();
    void navigate({ to: "/unlock" });
  }, [lock, navigate]);

  useEffect(() => {
    if (status !== "unlocked") return;

    autoLock.start(handleLock);

    // Reset timer on user activity
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    const resetHandler = () => {
      autoLock.resetTimer();
    };

    for (const event of events) {
      document.addEventListener(event, resetHandler, { passive: true });
    }

    return () => {
      autoLock.stop();
      for (const event of events) {
        document.removeEventListener(event, resetHandler);
      }
    };
  }, [status, handleLock]);
}
