import type { CompartmentId } from "./types";

/**
 * The page's only categorical scale: one hue per tumour compartment, assigned
 * in fixed order and never cycled or reassigned by rank.
 *
 * Validated all-pairs (compartments neighbour each other anywhere in the
 * volume) against this page's surfaces in both modes — worst CVD ΔE 9.2 light
 * / 9.4 dark, worst normal-vision ΔE 24.0 light / 20.9 dark. A fourth hue does
 * not clear the all-pairs floors, so sampling strategies are distinguished by
 * small multiples and labels instead of colour. Hex lives in globals.css so
 * light/dark swap in one place; this maps compartment → CSS custom property.
 */
export const REGION_VAR_BY_ID: Record<CompartmentId, string> = {
  NCR: "var(--region-a)",
  ED: "var(--region-b)",
  ET: "var(--region-c)",
};

/** Matching CSS variable names, for canvas code that must read raw hex. */
export const REGION_TOKEN_BY_ID: Record<CompartmentId, string> = {
  NCR: "--region-a",
  ED: "--region-b",
  ET: "--region-c",
};

export const COMPARTMENT_ORDER: CompartmentId[] = ["NCR", "ED", "ET"];

export const COMPARTMENT_LABEL: Record<CompartmentId, string> = {
  NCR: "Necrotic core",
  ED: "Infiltration / edema",
  ET: "Enhancing rim",
};
