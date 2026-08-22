/** Percent of a 0..1 proportion, e.g. 0.734 → "73%". */
export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * A difference between two proportions, in percentage points. Always signed,
 * because the sign is the point.
 */
export function pp(value: number, digits = 0): string {
  const points = value * 100;
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toFixed(digits)} pp`;
}

/** Direction of a delta, for choosing an icon and a written label. */
export function direction(value: number): "up" | "down" | "flat" {
  if (value > 0.0005) return "up";
  if (value < -0.0005) return "down";
  return "flat";
}
