"use client";

import type { Theme } from "@/lib/useTheme";

interface Props {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

/**
 * Both modes are selected, not flipped — each has its own validated palette
 * steps in globals.css. The toggle stamps data-theme on <html>, which wins over
 * the OS preference in both directions.
 *
 * The label is suppressed from hydration checking because the server cannot
 * know the viewer's preference; the CSS has already applied the right palette
 * by the time this renders.
 */
export default function ThemeToggle({ theme, onChange }: Props) {
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`Switch to ${next} mode`}
      suppressHydrationWarning
      className="rounded-lg bg-surface-1 px-3 py-1.5 text-sm text-ink-secondary ring-1 ring-hairline transition-colors hover:text-ink-primary"
    >
      <span aria-hidden>{theme === "dark" ? "☾" : "☀"}</span>
      <span className="ml-1.5">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
