"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/**
 * The <html data-theme> attribute is the source of truth — the inline script in
 * layout.tsx stamps it before first paint, so CSS never flashes the wrong
 * palette. React subscribes to that external state rather than mirroring it in
 * component state, which is why this is a store and not a useEffect.
 *
 * With no stored preference the attribute stays absent and the OS setting wins,
 * so a later OS change still propagates.
 */

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
  };
}

function getSnapshot(): Theme {
  const attribute = document.documentElement.getAttribute("data-theme");
  if (attribute === "light" || attribute === "dark") return attribute;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The server cannot know the viewer's preference; CSS covers the gap. */
function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage — the attribute still applies.
    }
    notify();
  }, []);

  return [theme, setTheme];
}
