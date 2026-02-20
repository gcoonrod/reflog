import { useEffect } from "react";
import { register } from "@/services/keyboard";
import type { KeyboardShortcut } from "@/types";

export function useKeyboard(shortcut: KeyboardShortcut, deps: unknown[] = []) {
  useEffect(() => {
    return register(shortcut);
    // Deps intentionally controlled by caller
  }, deps);
}
