/**
 * Shared contract between the Next.js client and the Python server.
 *
 * Keep this file in sync with the server's Pydantic models. Field names are
 * camelCase on the wire; if the server prefers snake_case, alias on the Python
 * side (`Field(alias=...)` + `populate_by_name=True`) rather than changing here.
 *
 * NOTHING in this pipeline is clinical. Every map is synthetic and every metric
 * describes a simulation, not a patient.
 */

export type RegionId = "A" | "B" | "C";

/** Normalised coordinates in [0, 1] — origin top-left, matching image space. */
export interface Point {
  x: number;
  y: number;
}

export type RegionCharacter = "high-density" | "low-density" | "heterogeneous";

export interface RegionMeta {
  id: RegionId;
  label: string;
  character: RegionCharacter;
  /** Voxel count belonging to this region. */
  voxels: number;
  /** Share of total tumour volume, 0..1. Shares across regions sum to 1. */
  trueShare: number;
  centroid: Point;
}

/**
 * A synthetic MRI slice plus its ground-truth region segmentation.
 *
 * `labels` and `intensity` are row-major, length `width * height`. For the
 * hackathon they travel as plain JSON arrays; if payload size becomes a problem
 * the server can switch to base64 PNG/npy and the client can decode — only the
 * two array fields would change shape.
 */
export interface TumourMap {
  seed: number;
  width: number;
  height: number;
  /** 0 = not tumour, 1..3 = region A..C. */
  labels: number[];
  /** MRI-like grayscale, 0..1. 0 outside the head. */
  intensity: number[];
  regions: RegionMeta[];
  /** Total tumour voxels — the denominator behind every `trueShare`. */
  tumourVoxels: number;
}

export type StrategyId = "traditional" | "ai-guided";

export interface BiopsyPath {
  id: number;
  /** Where the needle enters, outside the head. */
  entry: Point;
  /** Where the core is taken. */
  target: Point;
  /** Region label of each voxel in the core; 0 entries are non-tumour. */
  coreLabels: number[];
  /** True when the core contains at least one tumour voxel. */
  hit: boolean;
}

export interface SamplingMetrics {
  passes: number;
  hits: number;
  /** hits / passes, 0..1. */
  hitRate: number;
  /**
   * 1 − total variation distance between the sampled region distribution and
   * the true one, 0..1. 1.0 means the sample mirrors the tumour's composition;
   * 0 means it missed the tumour entirely. Concentrating every pass in one
   * region caps this at that region's true share.
   */
  representativeCoverage: number;
  /** Share of sampled tumour voxels drawn from each region, 0..1. */
  sampledShare: Record<RegionId, number>;
  /** How many distinct regions the sample touched at all (0..3). */
  regionsTouched: number;
}

export interface StrategyResult {
  strategy: StrategyId;
  label: string;
  /** One-line description of how targets were chosen. */
  approach: string;
  paths: BiopsyPath[];
  metrics: SamplingMetrics;
}

/** Structured output of the local model — the raw slice never leaves the box. */
export interface GemmaAnalysis {
  model: string;
  /** Always true: this stage is the privacy boundary. */
  runsLocally: true;
  summary: string;
  regions: Array<{
    id: RegionId;
    label: string;
    density: string;
    note: string;
  }>;
  /** 0..1 — how unevenly tumour volume is split across regions. */
  heterogeneityIndex: number;
}

/** Cloud reasoning over the structured summary only — never over the image. */
export interface GeminiStrategy {
  model: string;
  rationale: string;
  /** How many passes to spend on each region. */
  allocation: Array<{ region: RegionId; passes: number }>;
  /** Approach corridor the needle may enter through, in degrees. */
  entryArcDegrees: [number, number];
}

export interface RunResult {
  map: TumourMap;
  analysis: GemmaAnalysis;
  strategy: GeminiStrategy;
  results: Record<StrategyId, StrategyResult>;
  /** AI-guided minus traditional, in absolute proportion (not percent). */
  delta: {
    hitRate: number;
    representativeCoverage: number;
  };
  /** Where the numbers came from, so the UI can be honest about it. */
  source: "local-simulation" | "server";
}

export interface RunRequest {
  seed: number;
  /** Biopsy passes per strategy. */
  passes: number;
  gridSize?: number;
}

/** Stages the UI walks through while a run is in flight. */
export type PipelineStage =
  | "idle"
  | "synthesising"
  | "gemma"
  | "gemini"
  | "simulating"
  | "comparing"
  | "done";
