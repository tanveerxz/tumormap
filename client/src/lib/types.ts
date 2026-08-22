/**
 * Contract with the Python server (`backend/api.py`).
 *
 * IMPORTANT — this is not synthetic data. Everything the server returns is
 * derived from real, de-identified research imaging (OpenNeuro, subject
 * sub-NSK46). The UI must describe it as such: de-identified research data
 * used for a methods demonstration, never as a clinical tool and never as
 * simulated phantom data.
 */

/** Compartment ids from the segmentation's 1/2/3 labels. */
export type CompartmentId = "NCR" | "ED" | "ET";

export interface Compartment {
  label: number;
  id: CompartmentId;
  name: string;
  short: string;
  note: string;
  voxels: number;
  volumeCm3: number;
  /** Share of total tumour volume, 0..1. */
  trueShare: number;
  centroid: [number, number, number];
}

export interface CaseFeatures {
  subjectId: string;
  space: string;
  shape: [number, number, number];
  voxelSizeMm: [number, number, number];
  tumourVoxels: number;
  tumourVolumeCm3: number;
  centroid: [number, number, number];
  regions: Compartment[];
}

export interface Provenance {
  source: string;
  /** Always false — the imaging is real. */
  synthetic: boolean;
  maskSpace: string;
  scanSpace: string;
  /** False: mask is MNI152, scans are native, no published transform. */
  registered: boolean;
  note: string;
  /** False: the 1/2/3 → NCR/ED/ET mapping is assumed, not confirmed. */
  labelSemanticsConfirmed: boolean;
}

export interface CaseResponse {
  features: CaseFeatures;
  acquisition: {
    manufacturer?: string;
    model?: string;
    fieldStrengthT?: number;
    sequence?: string;
  };
  modalities: string[];
  provenance: Provenance;
}

export interface BiopsyCore {
  voxel: [number, number, number];
  /** 0 = outside tumour, 1..3 = compartment. */
  label: number;
}

export interface BiopsyPass {
  id: number;
  entry: [number, number, number];
  target: [number, number, number];
  cores: BiopsyCore[];
  hit: boolean;
}

export interface StrategyResult {
  name: string;
  approach: string;
  passes: number;
  hits: number;
  hitRate: number;
  coresSampled: number;
  /** Shannon diversity H'. */
  shannon: number;
  /** Pielou's evenness J' — H' / ln(3). Is the sample balanced? */
  evenness: number;
  /** 1 − total variation distance. Does the sample match THIS tumour? */
  representativeness: number;
  regionsTouched: number;
  sampledShare: Record<CompartmentId, number>;
  sampledCounts: Record<CompartmentId, number>;
  biopsyPasses: BiopsyPass[];
}

/** How the pass budget was split, and whether Gemma actually decided it. */
export interface StrategyProposal {
  allocation: Record<string, number>;
  /** False means the model did not run and this is the deterministic fallback. */
  modelRan: boolean;
  model: string | null;
  source: string;
  reason?: string;
  raw?: string;
  /** The model's raw weighting, before rescaling to the pass budget. */
  weights?: Record<string, number>;
  /**
   * True when the model's counts did not sum to the budget and were rescaled.
   * Surfaced so the UI never implies the model did arithmetic it did not do —
   * a small edge model gives a sound ratio but may not hit an exact total.
   */
  rescaled?: boolean;
  requestedTotal?: number;
}

export interface Narrative {
  text: string;
  /** False means deterministic text, not model output. Never hide this. */
  modelRan: boolean;
  model: string;
  reason?: string;
}

export interface RunResponse {
  features: CaseFeatures;
  strategy: StrategyProposal;
  results: {
    baseline: StrategyResult;
    stratified: StrategyResult;
  };
  delta: {
    hitRate: number;
    evenness: number;
    representativeness: number;
  };
  narrative: Narrative | null;
  source: "server";
}

export interface PointCloudRegion {
  label: number;
  id: CompartmentId;
  /** Normalised to a unit cube centred on the origin. */
  points: Array<[number, number, number]>;
}

export interface PointCloud {
  space: string;
  regions: PointCloudRegion[];
}

export interface MriSlice {
  modality: string;
  plane: string;
  sliceIndex: number;
  space: string;
  /** Always false — never overlay the mask on this. */
  registeredToMask: boolean;
  width: number;
  height: number;
  /** Grayscale PNG as a data URI. Encoded server-side: the raw byte array
   *  cost ~480 kB per slice as JSON, versus under 60 kB as PNG. */
  png: string;
}

export interface HealthResponse {
  status: string;
  gemma: {
    model: string;
    available: boolean;
    reason?: string | null;
  };
}

/** Stages the guided walkthrough steps through. */
export type StepId = "case" | "compartments" | "baseline" | "gemma" | "verdict";
