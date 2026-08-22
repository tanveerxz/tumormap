/**
 * The end-to-end run, implemented locally.
 *
 * This mirrors what the Python server will do, so the interface can be built
 * and demoed before the backend exists. `lib/api.ts` prefers the server when
 * one is configured and falls back here otherwise.
 *
 * The two model stages are stubbed with deterministic logic derived from the
 * map. They are stubs of *where the models go*, not of what they conclude.
 */

import { allocateByShare, simulate, stratifiedPlan, traditionalPlan } from "./biopsy";
import { REGION_PROFILE } from "./tumour";
import { generateTumourMap } from "./tumour";
import type {
  GemmaAnalysis,
  GeminiStrategy,
  RunRequest,
  RunResult,
  TumourMap,
} from "./types";

const DENSITY_WORDING: Record<string, string> = {
  "high-density": "high cellular density",
  "low-density": "low cellular density",
  heterogeneous: "mixed density, high internal variance",
};

/**
 * Normalised Shannon entropy of the region volume split, 0..1. A value near 1
 * means the tumour is evenly divided between regions — which is precisely when
 * sampling one spot is least defensible.
 */
function heterogeneityIndex(map: TumourMap): number {
  const shares = map.regions.map((region) => region.trueShare).filter((s) => s > 0);
  if (shares.length <= 1) return 0;
  const entropy = -shares.reduce((sum, s) => sum + s * Math.log(s), 0);
  return entropy / Math.log(map.regions.length);
}

/** Stage 1 — runs on the local model; the slice itself never leaves the machine. */
export function analyseLocally(map: TumourMap): GemmaAnalysis {
  const index = heterogeneityIndex(map);
  const dominant = [...map.regions].sort((a, b) => b.trueShare - a.trueShare)[0];

  return {
    model: "gemma (local)",
    runsLocally: true,
    summary:
      `Tumour detected across ${map.regions.length} distinct regions. ` +
      `${dominant.label} is dominant at ${(dominant.trueShare * 100).toFixed(0)}% of volume. ` +
      `Heterogeneity index ${index.toFixed(2)}.`,
    regions: map.regions.map((region) => ({
      id: region.id,
      label: region.label,
      density: DENSITY_WORDING[region.character] ?? region.character,
      note: REGION_PROFILE[region.id].note,
    })),
    heterogeneityIndex: index,
  };
}

/**
 * Stage 2 — cloud reasoning. It receives the structured summary above, never
 * the image, which is the whole privacy argument of the architecture.
 */
export function proposeStrategy(map: TumourMap, passes: number): GeminiStrategy {
  const allocation = allocateByShare(map, passes);
  const smallest = [...map.regions].sort((a, b) => a.trueShare - b.trueShare)[0];

  return {
    model: "gemini (cloud)",
    rationale:
      `Volume share is uneven, so passes are apportioned by share rather than ` +
      `concentrated on the dominant mass. ${smallest.label} holds ` +
      `${(smallest.trueShare * 100).toFixed(0)}% of volume and would be missed ` +
      `entirely by a single-corridor approach; it is allocated ` +
      `${allocation.find((a) => a.region === smallest.id)?.passes ?? 0} passes. ` +
      `Entry is widened so targets in every region stay reachable.`,
    allocation,
    entryArcDegrees: [160, 380],
  };
}

/** Run the whole thing locally, in one synchronous pass. */
export function runLocally(request: RunRequest): RunResult {
  const { seed, passes, gridSize = 176 } = request;
  const map = generateTumourMap(seed, gridSize);

  const analysis = analyseLocally(map);
  const strategy = proposeStrategy(map, passes);

  const traditional = simulate(map, traditionalPlan(map, passes), seed + 1);
  const guided = simulate(
    map,
    stratifiedPlan(map, passes, strategy.allocation, strategy.entryArcDegrees),
    seed + 2,
  );

  return {
    map,
    analysis,
    strategy,
    results: { traditional, "ai-guided": guided },
    delta: {
      hitRate: guided.metrics.hitRate - traditional.metrics.hitRate,
      representativeCoverage:
        guided.metrics.representativeCoverage - traditional.metrics.representativeCoverage,
    },
    source: "local-simulation",
  };
}
