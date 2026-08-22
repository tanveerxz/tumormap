/**
 * Client for the Python server.
 *
 * There is no local fallback any more. The data is real imaging that lives
 * server-side, so if the server is down the honest thing is to say so rather
 * than quietly substitute made-up numbers.
 */

import type {
  CaseResponse,
  HealthResponse,
  MriSlice,
  PointCloud,
  RunResponse,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal });
  if (!response.ok) {
    throw new ApiError(`${path} returned ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export const fetchHealth = (signal?: AbortSignal) => get<HealthResponse>("/health", signal);

export const fetchCase = (signal?: AbortSignal) => get<CaseResponse>("/api/case", signal);

export const fetchPointCloud = (maxPerRegion = 1400, signal?: AbortSignal) =>
  get<PointCloud>(`/api/pointcloud?maxPerRegion=${maxPerRegion}`, signal);

export const fetchSlice = (modality = "T1_post", plane = "axial", signal?: AbortSignal) =>
  get<MriSlice>(`/api/slice?modality=${modality}&plane=${plane}`, signal);

/**
 * Fast path: deterministic simulation, no model. Returns in well under a
 * second, so it is safe to put behind a slider.
 */
export async function runSimulation(
  passes: number,
  allocation?: Record<string, number>,
  signal?: AbortSignal,
): Promise<RunResponse> {
  const response = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passes, useGemma: false, allocation: allocation ?? null }),
    signal,
  });
  if (!response.ok) {
    throw new ApiError(`/api/run returned ${response.status}`, response.status);
  }
  return (await response.json()) as RunResponse;
}

/**
 * Slow path: a local Gemma generation, tens of seconds. Called once, on
 * demand, never on the input path.
 */
export async function requestPlan(
  passes: number,
  signal?: AbortSignal,
): Promise<Pick<RunResponse, "strategy" | "narrative">> {
  const response = await fetch(`${API_BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passes }),
    signal,
  });
  if (!response.ok) {
    throw new ApiError(`/api/plan returned ${response.status}`, response.status);
  }
  return (await response.json()) as Pick<RunResponse, "strategy" | "narrative">;
}
