/**
 * Biopsy path simulation and sampling metrics.
 *
 * A "pass" is one needle: it enters through a point on the skull, travels to a
 * target, and takes a short core at the tip. We score the *set* of passes, not
 * any single one — the question is whether the collected tissue reflects the
 * tumour's composition.
 */

import { gaussian, makeRng, type Rng } from "./random";
import { indexToPoint, regionVoxelIndices, REGION_IDS } from "./tumour";
import type {
  BiopsyPath,
  Point,
  RegionId,
  SamplingMetrics,
  StrategyId,
  StrategyResult,
  TumourMap,
} from "./types";

/** Needle enters here — on a circle comfortably outside the head outline. */
const ENTRY_RADIUS = 0.60;
const HEAD_CENTRE: Point = { x: 0.5, y: 0.5 };

/** Length of the tissue core taken at the needle tip, in normalised units. */
const CORE_LENGTH = 0.05;
/** Half-width of the core; sampled at three lateral offsets. */
const CORE_HALF_WIDTH = 0.006;
/** Stereotactic placement error applied to every target. */
const NEEDLE_ERROR_SD = 0.016;

export interface SamplingPlan {
  strategy: StrategyId;
  label: string;
  approach: string;
  passes: number;
  /** Approach corridor the needle may enter through, in degrees. */
  entryArcDegrees: [number, number];
  /** Intended target for pass `i`, before placement error. */
  pickTarget: (rng: Rng, i: number) => Point;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Sample the core at the needle tip, returning the label of each voxel in it. */
function sampleCore(map: TumourMap, entry: Point, target: Point): number[] {
  const dx = target.x - entry.x;
  const dy = target.y - entry.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  // Perpendicular, for the core's lateral extent.
  const px = -uy;
  const py = ux;

  const steps = Math.max(2, Math.round(CORE_LENGTH * map.width));
  const labels: number[] = [];

  for (let s = 0; s <= steps; s++) {
    // Walk backward from the tip along the needle axis.
    const t = (s / steps) * CORE_LENGTH;
    const cx = target.x - ux * t;
    const cy = target.y - uy * t;

    for (const offset of [-CORE_HALF_WIDTH, 0, CORE_HALF_WIDTH]) {
      const sx = cx + px * offset;
      const sy = cy + py * offset;
      const col = Math.floor(clamp01(sx) * map.width);
      const row = Math.floor(clamp01(sy) * map.height);
      const idx = row * map.width + col;
      if (idx >= 0 && idx < map.labels.length) labels.push(map.labels[idx]);
    }
  }

  return labels;
}

function computeMetrics(map: TumourMap, paths: BiopsyPath[]): SamplingMetrics {
  const counts: Record<RegionId, number> = { A: 0, B: 0, C: 0 };
  let sampledTotal = 0;
  let hits = 0;

  for (const path of paths) {
    if (path.hit) hits++;
    for (const label of path.coreLabels) {
      if (label >= 1 && label <= 3) {
        counts[REGION_IDS[label - 1]]++;
        sampledTotal++;
      }
    }
  }

  const sampledShare: Record<RegionId, number> = { A: 0, B: 0, C: 0 };
  if (sampledTotal > 0) {
    for (const id of REGION_IDS) sampledShare[id] = counts[id] / sampledTotal;
  }

  // Total variation distance between the sampled and true region mixes.
  // Coverage of 1 means the core set mirrors the tumour's composition.
  let tvd = 0;
  for (const region of map.regions) {
    tvd += Math.abs(sampledShare[region.id] - region.trueShare);
  }
  tvd *= 0.5;

  return {
    passes: paths.length,
    hits,
    hitRate: paths.length > 0 ? hits / paths.length : 0,
    representativeCoverage: sampledTotal > 0 ? 1 - tvd : 0,
    sampledShare,
    regionsTouched: REGION_IDS.filter((id) => counts[id] > 0).length,
  };
}

export function simulate(map: TumourMap, plan: SamplingPlan, seed: number): StrategyResult {
  const rng = makeRng(seed);
  const [arcStart, arcEnd] = plan.entryArcDegrees;
  const paths: BiopsyPath[] = [];

  for (let i = 0; i < plan.passes; i++) {
    const intended = plan.pickTarget(rng, i);
    const target: Point = {
      x: clamp01(intended.x + gaussian(rng, 0, NEEDLE_ERROR_SD)),
      y: clamp01(intended.y + gaussian(rng, 0, NEEDLE_ERROR_SD)),
    };

    const angleDeg = arcStart + rng() * (arcEnd - arcStart);
    const angle = (angleDeg * Math.PI) / 180;
    const entry: Point = {
      x: HEAD_CENTRE.x + Math.cos(angle) * ENTRY_RADIUS,
      y: HEAD_CENTRE.y + Math.sin(angle) * ENTRY_RADIUS,
    };

    const coreLabels = sampleCore(map, entry, target);
    paths.push({
      id: i,
      entry,
      target,
      coreLabels,
      hit: coreLabels.some((label) => label >= 1 && label <= 3),
    });
  }

  return {
    strategy: plan.strategy,
    label: plan.label,
    approach: plan.approach,
    paths,
    metrics: computeMetrics(map, paths),
  };
}

/**
 * The baseline: aim every pass at the largest visible mass through one narrow
 * approach corridor. Clinically sensible and easy — and it is exactly what
 * over-samples a single region.
 */
export function traditionalPlan(map: TumourMap, passes: number): SamplingPlan {
  const dominant = [...map.regions].sort((a, b) => b.trueShare - a.trueShare)[0];
  const base = 250;

  return {
    strategy: "traditional",
    label: "Traditional",
    approach: "All passes aimed at the dominant mass through one narrow corridor.",
    passes,
    entryArcDegrees: [base - 18, base + 18],
    pickTarget: (rng) => ({
      x: dominant.centroid.x + gaussian(rng, 0, 0.03),
      y: dominant.centroid.y + gaussian(rng, 0, 0.03),
    }),
  };
}

/**
 * The proposed alternative: spend passes on each region in proportion to how
 * much of the tumour it actually represents, spread across a wide corridor.
 */
export function stratifiedPlan(
  map: TumourMap,
  passes: number,
  allocation: Array<{ region: RegionId; passes: number }>,
  entryArcDegrees: [number, number],
): SamplingPlan {
  const buckets = regionVoxelIndices(map);

  // Flatten the allocation into a per-pass region schedule.
  const schedule: number[] = [];
  allocation.forEach(({ region, passes: count }) => {
    const index = REGION_IDS.indexOf(region);
    for (let i = 0; i < count; i++) schedule.push(index);
  });
  while (schedule.length < passes) schedule.push(0);

  return {
    strategy: "ai-guided",
    label: "AI-guided",
    approach: "Passes allocated across regions by volume share, wide corridor.",
    passes,
    entryArcDegrees,
    pickTarget: (rng, i) => {
      const regionIndex = schedule[i % schedule.length];
      const voxels = buckets[regionIndex];
      if (!voxels || voxels.length === 0) {
        return map.regions[regionIndex]?.centroid ?? HEAD_CENTRE;
      }
      // Stratified random draw from inside the region itself.
      const pick = voxels[Math.floor(rng() * voxels.length)];
      return indexToPoint(pick, map.width);
    },
  };
}

/** Largest-remainder apportionment, so the allocation sums to exactly `passes`. */
export function allocateByShare(
  map: TumourMap,
  passes: number,
): Array<{ region: RegionId; passes: number }> {
  const raw = map.regions.map((region) => ({
    region: region.id,
    exact: region.trueShare * passes,
  }));

  const allocation = raw.map((entry) => ({
    region: entry.region,
    passes: Math.floor(entry.exact),
  }));

  let remaining = passes - allocation.reduce((sum, entry) => sum + entry.passes, 0);
  const byRemainder = [...raw]
    .map((entry, i) => ({ i, remainder: entry.exact - Math.floor(entry.exact) }))
    .sort((a, b) => b.remainder - a.remainder);

  let cursor = 0;
  while (remaining > 0 && byRemainder.length > 0) {
    allocation[byRemainder[cursor % byRemainder.length].i].passes++;
    remaining--;
    cursor++;
  }

  return allocation;
}
