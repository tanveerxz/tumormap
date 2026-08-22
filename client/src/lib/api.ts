/**
 * Client for the Python server, with a local fallback.
 *
 * Set NEXT_PUBLIC_API_URL to point at the backend (see .env.local.example).
 * With it unset — or if the request fails — the run is computed in-browser by
 * `lib/pipeline.ts` and the UI labels itself as running on local simulation.
 * That keeps the interface demoable while the server is still being written.
 */

import { runLocally } from "./pipeline";
import type { RunRequest, RunResult } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export const hasConfiguredServer = API_BASE.length > 0;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** POST /api/run — see `types.ts` for the request and response shapes. */
export async function runPipeline(
  request: RunRequest,
  signal?: AbortSignal,
): Promise<{ result: RunResult; fellBack: boolean; reason?: string }> {
  if (!hasConfiguredServer) {
    return { result: runLocally(request), fellBack: false };
  }

  try {
    const response = await fetch(`${API_BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      throw new ApiError(`Server returned ${response.status}`, response.status);
    }

    const result = (await response.json()) as RunResult;
    return { result: { ...result, source: "server" }, fellBack: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      result: runLocally(request),
      fellBack: true,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** GET /health — used only to colour the connection badge. */
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  if (!hasConfiguredServer) return false;
  try {
    const response = await fetch(`${API_BASE}/health`, { signal });
    return response.ok;
  } catch {
    return false;
  }
}
