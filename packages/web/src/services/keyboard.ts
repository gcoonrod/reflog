import type { KeyboardShortcut } from "@/types";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

const shortcuts = new Map<string, KeyboardShortcut>();

function normalizeKeys(keys: string): string {
  return keys.toLowerCase().replace(/\s+/g, "");
}

function matchesShortcut(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split("+");
  const key = parts[parts.length - 1];
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");

  const modPressed = isMac ? e.metaKey : e.ctrlKey;

  if (needsMod && !modPressed) return false;
  if (needsShift && !e.shiftKey) return false;

  return e.key.toLowerCase() === key;
}

function handleKeyDown(e: KeyboardEvent) {
  for (const shortcut of shortcuts.values()) {
    if (matchesShortcut(e, normalizeKeys(shortcut.keys))) {
      if (shortcut.preventDefault !== false) {
        e.preventDefault();
      }
      shortcut.handler();
      return;
    }
  }
}

let listening = false;

function ensureListener() {
  if (!listening) {
    document.addEventListener("keydown", handleKeyDown);
    listening = true;
  }
}

export function register(shortcut: KeyboardShortcut): () => void {
  const key = normalizeKeys(shortcut.keys);
  shortcuts.set(key, shortcut);
  ensureListener();

  return () => {
    shortcuts.delete(key);
  };
}

export function unregisterAll(): void {
  shortcuts.clear();
  if (listening) {
    document.removeEventListener("keydown", handleKeyDown);
    listening = false;
  }
}
