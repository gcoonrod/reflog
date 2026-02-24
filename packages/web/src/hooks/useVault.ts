import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  createElement,
  type ReactNode,
} from "react";
import * as vault from "@/services/vault";
import { useAuth } from "@/hooks/useAuth";

interface VaultState {
  status: "loading" | "no-vault" | "locked" | "unlocked";
  isAuthenticated: boolean;
  setup: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
}

const VaultContext = createContext<VaultState | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<VaultState["status"]>("loading");

  useEffect(() => {
    void vault.isSetUp().then((hasVault) => {
      setStatus(hasVault ? "locked" : "no-vault");
    });
  }, []);

  const setup = useCallback(async (passphrase: string) => {
    await vault.setup(passphrase);
    setStatus("unlocked");
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    await vault.unlock(passphrase);
    setStatus("unlocked");
  }, []);

  const lock = useCallback(() => {
    vault.lock();
    setStatus("locked");
  }, []);

  return createElement(
    VaultContext.Provider,
    { value: { status, isAuthenticated, setup, unlock, lock } },
    children,
  );
}

export function useVault(): VaultState {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return ctx;
}
