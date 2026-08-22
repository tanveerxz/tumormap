import AnimatedNumber from "./AnimatedNumber";
import { direction } from "@/lib/format";

interface Props {
  label: string;
  /** Raw proportion, 0..1 — the tile springs between values as it changes. */
  value: number;
  format: (value: number) => string;
  /** Signed change vs the baseline strategy, as a proportion. */
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  pending?: boolean;
}

const ARROW = { up: "↑", down: "↓", flat: "→" } as const;
const WORD = { up: "higher", down: "lower", flat: "unchanged" } as const;

export default function StatTile({
  label,
  value,
  format,
  delta,
  deltaLabel,
  hint,
  pending = false,
}: Props) {
  const dir = delta === undefined ? null : direction(delta);

  return (
    <div
      className="panel rounded-2xl p-5 ring-1 ring-hairline transition-opacity duration-200"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <div className="label-mono text-ink-muted">{label}</div>

      {/* Stat values stay in the sans with proportional figures — tabular-nums
          would make a number this size read loose. */}
      <AnimatedNumber
        value={value}
        format={format}
        className="figure-md mt-2.5 block text-ink-primary"
      />

      {dir && (
        // Icon + word, never colour alone.
        <div
          className="mt-3 flex items-center gap-1.5 text-xs"
          style={{ color: dir === "up" ? "var(--delta-good)" : "var(--ink-secondary)" }}
        >
          <span aria-hidden>{ARROW[dir]}</span>
          <span className="mono font-medium">{deltaLabel}</span>
          <span className="text-ink-muted">{WORD[dir]}</span>
        </div>
      )}

      {hint && <p className="caption mt-3 text-ink-secondary">{hint}</p>}
    </div>
  );
}
