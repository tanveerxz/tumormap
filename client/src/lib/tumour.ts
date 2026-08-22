/**
 * Synthetic MRI slice generator.
 *
 * This produces a *fake* axial slice: a head outline, some brain texture, and a
 * single tumour mass partitioned into three sub-regions with different
 * character. It is deliberately not derived from patient data — the point is to
 * have known ground truth so sampling strategies can be scored against it.
 */

import { fbm, makeRng, type Rng } from "./random";
import type { Point, RegionCharacter, RegionId, RegionMeta, TumourMap } from "./types";

export const REGION_IDS: RegionId[] = ["A", "B", "C"];

export const REGION_PROFILE: Record<
  RegionId,
  { label: string; character: RegionCharacter; note: string }
> = {
  A: {
    label: "Region A",
    character: "high-density",
    note: "Dense cellular core — the brightest, most obvious target on the slice.",
  },
  B: {
    label: "Region B",
    character: "low-density",
    note: "Diffuse infiltrative margin — lower signal, easy to under-sample.",
  },
  C: {
    label: "Region C",
    character: "heterogeneous",
    note: "Mixed viable and necrotic tissue — highest internal variance.",
  },
};

/** Region index (1..3) → RegionId. Index 0 means "not tumour". */
export function regionIdFromIndex(index: number): RegionId | null {
  return index >= 1 && index <= 3 ? REGION_IDS[index - 1] : null;
}

const BRAIN_CENTER: Point = { x: 0.5, y: 0.5 };
const BRAIN_RADIUS = { x: 0.36, y: 0.42 };

/** Is this normalised point inside the (noise-warped) brain outline? */
function insideBrain(x: number, y: number, seed: number): boolean {
  const dx = (x - BRAIN_CENTER.x) / BRAIN_RADIUS.x;
  const dy = (y - BRAIN_CENTER.y) / BRAIN_RADIUS.y;
  const r = Math.hypot(dx, dy);
  const warp = 0.94 + 0.12 * fbm(x * 4, y * 4, seed + 77, 3);
  return r < warp;
}

interface Blob {
  centre: Point;
  radius: number;
}

function placeBlobs(rng: Rng): Blob[] {
  // One mass, three overlapping sub-regions — not three separate tumours.
  const angle = rng() * Math.PI * 2;
  const offset = 0.09 + rng() * 0.05;
  const centre: Point = {
    x: BRAIN_CENTER.x + Math.cos(angle) * offset,
    y: BRAIN_CENTER.y + Math.sin(angle) * offset * 0.9,
  };

  const spread = 0.055 + rng() * 0.03;
  const theta = rng() * Math.PI * 2;

  return [
    // A is deliberately the largest: it is the mass a naive strategy aims at.
    { centre: { x: centre.x, y: centre.y }, radius: 0.098 + rng() * 0.016 },
    {
      centre: {
        x: centre.x + Math.cos(theta) * spread,
        y: centre.y + Math.sin(theta) * spread,
      },
      radius: 0.068 + rng() * 0.014,
    },
    {
      centre: {
        x: centre.x + Math.cos(theta + 2.3) * spread * 1.15,
        y: centre.y + Math.sin(theta + 2.3) * spread * 1.15,
      },
      radius: 0.058 + rng() * 0.014,
    },
  ];
}

function buildMap(seed: number, size: number): TumourMap {
  const rng = makeRng(seed);
  const blobs = placeBlobs(rng);

  const labels = new Array<number>(size * size).fill(0);
  const intensity = new Array<number>(size * size).fill(0);

  const counts = [0, 0, 0];
  const sums = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  let tumourVoxels = 0;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      // Sample at pixel centres.
      const x = (col + 0.5) / size;
      const y = (row + 0.5) / size;

      if (!insideBrain(x, y, seed)) {
        // Thin bright skull ring just outside the brain, then empty space.
        const dx = (x - BRAIN_CENTER.x) / BRAIN_RADIUS.x;
        const dy = (y - BRAIN_CENTER.y) / BRAIN_RADIUS.y;
        const r = Math.hypot(dx, dy);
        intensity[i] = r < 1.06 ? 0.30 : 0;
        continue;
      }

      // Base brain parenchyma: gentle texture, darker toward the midline.
      const texture = fbm(x * 7, y * 7, seed + 11, 4);
      const midline = Math.exp(-((x - 0.5) ** 2) / 0.0016);
      let value = 0.34 + texture * 0.15 - midline * 0.10;

      // Which sub-region claims this voxel? Warped distance keeps edges organic.
      let best = -Infinity;
      let bestIndex = 0;
      for (let k = 0; k < blobs.length; k++) {
        const blob = blobs[k];
        const d = Math.hypot(x - blob.centre.x, y - blob.centre.y);
        const warp = 0.78 + 0.44 * fbm(x * 9 + k * 31, y * 9 - k * 17, seed + 200 + k, 4);
        const score = blob.radius / Math.max(d * warp, 1e-6);
        if (score > best) {
          best = score;
          bestIndex = k + 1;
        }
      }

      if (best >= 1) {
        labels[i] = bestIndex;
        counts[bestIndex - 1]++;
        sums[bestIndex - 1].x += x;
        sums[bestIndex - 1].y += y;
        tumourVoxels++;

        // Each region reads differently on the slice — that visible contrast is
        // what the local model has to turn into structure.
        if (bestIndex === 1) {
          value = 0.70 + fbm(x * 12, y * 12, seed + 301, 3) * 0.14;
        } else if (bestIndex === 2) {
          value = 0.50 + fbm(x * 10, y * 10, seed + 302, 3) * 0.14;
        } else {
          const mix = fbm(x * 16, y * 16, seed + 303, 5);
          // Necrotic pockets: genuinely bimodal, not just noisier.
          value = mix > 0.56 ? 0.66 + mix * 0.16 : 0.24 + mix * 0.18;
        }
      }

      intensity[i] = Math.min(1, Math.max(0, value));
    }
  }

  const regions: RegionMeta[] = REGION_IDS.map((id, k) => {
    const voxels = counts[k];
    const profile = REGION_PROFILE[id];
    return {
      id,
      label: profile.label,
      character: profile.character,
      voxels,
      trueShare: tumourVoxels > 0 ? voxels / tumourVoxels : 0,
      centroid:
        voxels > 0
          ? { x: sums[k].x / voxels, y: sums[k].y / voxels }
          : { ...blobs[k].centre },
    };
  });

  return { seed, width: size, height: size, labels, intensity, regions, tumourVoxels };
}

/**
 * Generate a slice, retrying seeds until all three regions are substantial
 * enough to be worth sampling. Without this a run can produce a vestigial
 * region and the coverage metric stops meaning anything.
 */
export function generateTumourMap(seed: number, size = 176): TumourMap {
  let last = buildMap(seed, size);
  for (let attempt = 1; attempt < 12; attempt++) {
    const viable =
      last.tumourVoxels > size * size * 0.01 &&
      last.regions.every((region) => region.trueShare >= 0.08);
    if (viable) return last;
    last = buildMap(seed + attempt * 7919, size);
  }
  return last;
}

/** Row-major voxel indices for each region, used for stratified targeting. */
export function regionVoxelIndices(map: TumourMap): number[][] {
  const buckets: number[][] = [[], [], []];
  for (let i = 0; i < map.labels.length; i++) {
    const label = map.labels[i];
    if (label >= 1 && label <= 3) buckets[label - 1].push(i);
  }
  return buckets;
}

/** Convert a row-major index back to a normalised point at the voxel centre. */
export function indexToPoint(index: number, size: number): Point {
  return {
    x: ((index % size) + 0.5) / size,
    y: (Math.floor(index / size) + 0.5) / size,
  };
}
