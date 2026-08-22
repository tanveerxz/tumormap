import type { RegionId } from "./types";

/**
 * The page's only categorical scale: one hue per tumour region, assigned in
 * fixed order and never cycled or reassigned by rank.
 *
 * Validated all-pairs (regions can neighbour each other anywhere on the slice)
 * in both modes — worst CVD ΔE 9.2 light / 9.4 dark, worst normal-vision ΔE
 * 24.0 light / 20.9 dark. A fourth hue does not clear the all-pairs floors, so
 * sampling strategies are distinguished by small multiples and labels instead
 * of by colour. Actual hex values live in globals.css so light/dark swap in one
 * place; this maps region → CSS custom property.
 */
export const REGION_VAR_BY_ID: Record<RegionId, string> = {
  A: "var(--region-a)",
  B: "var(--region-b)",
  C: "var(--region-c)",
};
