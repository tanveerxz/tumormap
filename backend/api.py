"""
FastAPI surface for the Next.js client.

Everything served here derives from real, de-identified research imaging
(OpenNeuro, subject sub-NSK46). Two honesty constraints are enforced at this
layer rather than left to the UI:

- Every payload that involves the model carries `modelRan`, so the client can
  never present deterministic fallback output as Gemma's work.
- MRI slices are tagged `registeredToMask: false`, because the segmentation is
  in MNI152 space and the scans are in native space. They are shown side by
  side, never overlaid.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import gemma
from backend.data import (
    MRI_FILES,
    REGIONS,
    acquisition_metadata,
    mask_features,
    mri_slice,
    point_cloud,
)
from backend.sampling import centroid_strategy, monte_carlo, stratified_strategy

app = FastAPI(
    title="TumourMap — virtual biopsy sampling API",
    description=(
        "Simulates stereotactic biopsy sampling over a real de-identified "
        "glioblastoma segmentation and scores how representative the collected "
        "tissue is. Research demonstration; not a medical device."
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    passes: int = 24
    # Off by default: a Gemma pass costs two generations and tens of seconds,
    # which must not sit in the path of a slider drag. The client asks for it
    # explicitly at the replanning step.
    useGemma: bool = False
    # An allocation the caller already has (e.g. from a previous Gemma call),
    # so re-running at a new pass count does not re-query the model.
    allocation: dict[str, int] | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    status = gemma.is_available()
    return {
        "status": "ok",
        "gemma": {
            "model": gemma.DEFAULT_MODEL,
            "available": status["available"],
            "reason": status.get("reason"),
        },
    }


@app.get("/api/case")
def case() -> dict[str, Any]:
    """Segmentation features, provenance, and the compartment definitions."""
    return {
        "features": mask_features(),
        "acquisition": acquisition_metadata(),
        "modalities": list(MRI_FILES.keys()),
        "compartments": REGIONS,
        "provenance": {
            "source": "OpenNeuro — real de-identified research MRI",
            "synthetic": False,
            "maskSpace": "MNI152",
            "scanSpace": "native",
            "registered": False,
            "note": (
                "The segmentation and the scans are in different coordinate spaces and "
                "were not co-registered in the published data, so they are displayed "
                "separately rather than overlaid."
            ),
            "labelSemanticsConfirmed": False,
        },
    }


@app.get("/api/pointcloud")
def pointcloud(maxPerRegion: int = Query(default=1400, ge=100, le=4000)) -> dict[str, Any]:
    """Surface voxels per compartment, normalised for 3D rendering."""
    return point_cloud(max_per_region=maxPerRegion)


@app.get("/api/slice")
def slice_endpoint(
    modality: str = Query(default="T1_post"),
    plane: str = Query(default="axial"),
) -> dict[str, Any]:
    """One native-space MRI slice. Never carries a mask overlay — see /api/case."""
    if plane not in {"axial", "coronal", "sagittal"}:
        raise HTTPException(status_code=400, detail=f"Unknown plane: {plane}")
    try:
        return mri_slice(modality=modality, plane=plane)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/run")
def run(request: RunRequest) -> dict[str, Any]:
    """
    The full comparison: baseline centroid targeting vs a stratified plan.

    When Gemma is reachable it chooses the pass allocation and the stratified
    arm runs on the model's plan. Otherwise the allocation falls back to volume
    share and `strategy.modelRan` is false.
    """
    from backend.sampling import allocate_by_share

    features = mask_features()

    if request.allocation:
        # Caller supplied a plan (typically Gemma's, from /api/plan).
        proposal = {
            "allocation": request.allocation,
            "modelRan": True,
            "model": gemma.DEFAULT_MODEL,
            "source": "supplied allocation",
        }
    elif request.useGemma:
        proposal = gemma.propose_allocation(features, request.passes)
    else:
        proposal = {
            "allocation": allocate_by_share(request.passes),
            "modelRan": False,
            "model": None,
            "source": "volume-share apportionment",
        }

    baseline = centroid_strategy(request.passes)
    guided = stratified_strategy(request.passes, allocation=proposal["allocation"])

    comparison = {"baseline": baseline, "stratified": guided}
    narrative = gemma.explain(features, comparison) if request.useGemma else None

    return {
        "features": features,
        "strategy": proposal,
        "results": comparison,
        "delta": {
            "hitRate": round(guided["hitRate"] - baseline["hitRate"], 4),
            "evenness": round(guided["evenness"] - baseline["evenness"], 4),
            "representativeness": round(
                guided["representativeness"] - baseline["representativeness"], 4
            ),
        },
        "narrative": narrative,
        "source": "server",
    }


class PlanRequest(BaseModel):
    passes: int = 24


@app.post("/api/plan")
def plan(request: PlanRequest) -> dict[str, Any]:
    """
    Ask Gemma for the pass allocation, and nothing else.

    Split out from /api/run because it is the only slow call in the system —
    a local generation takes tens of seconds, and the rest of the UI must not
    wait behind it. The client fires this once, at the replanning step, and
    feeds the result back into /api/run.
    """
    features = mask_features()
    proposal = gemma.propose_allocation(features, request.passes)

    baseline = centroid_strategy(request.passes)
    guided = stratified_strategy(request.passes, allocation=proposal["allocation"])
    narrative = gemma.explain(features, {"baseline": baseline, "stratified": guided})

    return {"strategy": proposal, "narrative": narrative}


@app.get("/api/monte-carlo")
def monte_carlo_endpoint(
    iterations: int = Query(default=100, ge=10, le=1000),
    passes: int = Query(default=24, ge=3, le=96),
) -> dict[str, Any]:
    """Spread of both strategies across many seeds, rather than a single draw."""
    return monte_carlo(n_iterations=iterations, n_passes=passes)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
