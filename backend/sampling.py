"""
Virtual stereotactic biopsy simulation and sampling metrics.

A "pass" is one needle: it enters through a point on the cranial vault, travels
to a target, and yields a series of tissue cores along the distal track. We
score the *set* of passes, because the clinical question is not whether one
needle hit tumour — it is whether the collected tissue reflects the tumour's
composition.

Three metrics, deliberately kept separate:

- hit rate            did the core contain tumour at all (the easy bar)
- Shannon H' / Pielou J'   how evenly the sample spreads across compartments
- representativeness  1 - total variation distance between the sampled mix and
                      the true volumetric mix

J' asks "is the sample balanced?"; representativeness asks "does the sample
match *this* tumour?" A tumour split 80/10/10 has a perfectly representative
sample that is deliberately unbalanced, so the two disagree by design and both
are reported.
"""

from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np

from backend.data import LABELS, REGIONS, load_mask, mask_features, region_voxel_index

# Cores taken along the distal needle track, and their spacing in mm.
CORES_PER_PASS = 5
CORE_SPACING_MM = 3.0
# Stereotactic placement error applied to every target, in mm.
PLACEMENT_ERROR_MM = 2.5


def shannon_pielou(counts: dict[int, int], num_classes: int = 3) -> tuple[float, float]:
    """Shannon diversity H' and Pielou's evenness J' = H' / ln(S)."""
    total = sum(counts.values())
    if total == 0:
        return 0.0, 0.0
    h = 0.0
    for count in counts.values():
        if count > 0:
            p = count / total
            h -= p * math.log(p)
    max_h = math.log(num_classes) if num_classes > 1 else 1.0
    return round(h, 4), round(h / max_h if max_h > 0 else 0.0, 4)


def representativeness(counts: dict[int, int], true_shares: dict[int, float]) -> float:
    """
    1 - total variation distance between sampled and true compartment mixes.

    1.0 means the collected tissue mirrors the tumour. Concentrating every core
    in one compartment caps this at that compartment's true share.
    """
    total = sum(counts.values())
    if total == 0:
        return 0.0
    tvd = 0.5 * sum(
        abs(counts.get(label, 0) / total - true_shares.get(label, 0.0)) for label in LABELS
    )
    return round(1.0 - tvd, 4)


def _entry_point(shape: np.ndarray, angle: float, tilt: float) -> np.ndarray:
    """
    A cranial entry on the superior hemisphere of the volume's bounding sphere.

    The data is a tumour segmentation with no skull, so this is a geometric
    stand-in for a burr hole rather than a surgically validated location.
    """
    centre = shape / 2.0
    radius = float(shape.max()) * 0.62
    return centre + radius * np.array(
        [math.cos(angle) * math.cos(tilt), math.sin(angle) * math.cos(tilt), abs(math.sin(tilt))]
    )


def _sample_track(
    mask: np.ndarray, entry: np.ndarray, target: np.ndarray, zooms: np.ndarray
) -> list[dict[str, Any]]:
    """Take evenly spaced cores along the needle axis, ending at the target."""
    direction = target - entry
    length = float(np.linalg.norm(direction))
    unit = direction / length if length > 0 else np.array([0.0, 0.0, 1.0])

    # Convert mm spacing to voxel steps using the mean voxel size.
    step_voxels = CORE_SPACING_MM / float(np.mean(zooms))
    offsets = np.linspace(-(CORES_PER_PASS - 1) * step_voxels, 0.0, CORES_PER_PASS)

    shape = np.array(mask.shape)
    cores = []
    for offset in offsets:
        point = target + unit * offset
        voxel = np.clip(np.round(point).astype(int), 0, shape - 1)
        label = int(mask[voxel[0], voxel[1], voxel[2]])
        cores.append({"voxel": voxel.tolist(), "label": label})
    return cores


def _run_passes(
    n_passes: int,
    pick_target: Callable[[np.random.Generator, int], np.ndarray],
    entry_arc: tuple[float, float],
    seed: int,
) -> list[dict[str, Any]]:
    mask, _, zooms = load_mask()
    zooms_arr = np.array(zooms)
    shape = np.array(mask.shape, dtype=float)
    rng = np.random.default_rng(seed)

    error_voxels = PLACEMENT_ERROR_MM / float(np.mean(zooms))
    passes = []
    for i in range(n_passes):
        target = pick_target(rng, i) + rng.normal(0, error_voxels, size=3)
        angle = rng.uniform(*entry_arc)
        tilt = rng.uniform(0.35, 1.15)
        entry = _entry_point(shape, angle, tilt)

        cores = _sample_track(mask, entry, target, zooms_arr)
        passes.append(
            {
                "id": i,
                "entry": [round(float(v), 2) for v in entry],
                "target": [round(float(v), 2) for v in target],
                "cores": cores,
                "hit": any(c["label"] in REGIONS for c in cores),
            }
        )
    return passes


def evaluate(passes: list[dict[str, Any]], name: str, approach: str) -> dict[str, Any]:
    """Score a set of passes against the tumour's true composition."""
    features = mask_features()
    true_shares = {r["label"]: r["trueShare"] for r in features["regions"]}

    counts = {label: 0 for label in LABELS}
    sampled_total = 0
    hits = 0
    for p in passes:
        if p["hit"]:
            hits += 1
        for core in p["cores"]:
            if core["label"] in counts:
                counts[core["label"]] += 1
                sampled_total += 1

    h, j = shannon_pielou(counts)
    shares = {
        REGIONS[label]["id"]: round(counts[label] / sampled_total, 4) if sampled_total else 0.0
        for label in LABELS
    }

    return {
        "name": name,
        "approach": approach,
        "passes": len(passes),
        "hits": hits,
        "hitRate": round(hits / len(passes), 4) if passes else 0.0,
        "coresSampled": sampled_total,
        "shannon": h,
        "evenness": j,
        "representativeness": representativeness(counts, true_shares),
        "regionsTouched": sum(1 for label in LABELS if counts[label] > 0),
        "sampledShare": shares,
        "sampledCounts": {REGIONS[label]["id"]: counts[label] for label in LABELS},
        "biopsyPasses": passes,
    }


def centroid_strategy(n_passes: int, seed: int = 42) -> dict[str, Any]:
    """
    Baseline: aim every pass at the whole-tumour centroid through one narrow
    corridor. Standard practice, and the source of necrotic over-sampling.
    """
    features = mask_features()
    centroid = np.array(features["centroid"])

    return evaluate(
        _run_passes(
            n_passes,
            lambda rng, _i: centroid + rng.normal(0, 4.0, size=3),
            entry_arc=(0.6, 1.2),
            seed=seed,
        ),
        name="Centroid-targeted",
        approach="Every pass aimed at the geometric centroid through one narrow corridor.",
    )


def stratified_strategy(
    n_passes: int, allocation: dict[str, int] | None = None, seed: int = 43
) -> dict[str, Any]:
    """
    Allocate passes across compartments and draw targets from inside each one.

    `allocation` maps region id (NCR/ED/ET) to a pass count. When omitted it
    falls back to apportionment by volume share, so the strategy is only as
    good as whatever produced the allocation.
    """
    features = mask_features()
    buckets = region_voxel_index()

    if allocation is None:
        allocation = allocate_by_share(n_passes)

    id_to_label = {meta["id"]: label for label, meta in REGIONS.items()}
    schedule: list[int] = []
    for region_id, count in allocation.items():
        label = id_to_label.get(region_id)
        if label is not None:
            schedule.extend([label] * int(count))
    if not schedule:
        schedule = [r["label"] for r in features["regions"]]
    while len(schedule) < n_passes:
        schedule.append(schedule[len(schedule) % len(schedule)])

    def pick(rng: np.random.Generator, i: int) -> np.ndarray:
        label = schedule[i % len(schedule)]
        coords = buckets.get(label)
        if coords is None or len(coords) == 0:
            return np.array(features["centroid"])
        return coords[rng.integers(0, len(coords))].astype(float)

    return evaluate(
        _run_passes(n_passes, pick, entry_arc=(0.0, 2 * math.pi), seed=seed),
        name="Compartment-stratified",
        approach="Passes allocated across compartments, targets drawn from inside each.",
    )


def allocate_by_share(n_passes: int) -> dict[str, int]:
    """Largest-remainder apportionment by volume share, summing to n_passes."""
    features = mask_features()
    exact = [(r["id"], r["trueShare"] * n_passes) for r in features["regions"]]
    alloc = {rid: int(math.floor(v)) for rid, v in exact}

    remaining = n_passes - sum(alloc.values())
    for rid, v in sorted(exact, key=lambda kv: kv[1] - math.floor(kv[1]), reverse=True):
        if remaining <= 0:
            break
        alloc[rid] += 1
        remaining -= 1
    return alloc


def monte_carlo(n_iterations: int = 100, n_passes: int = 12) -> dict[str, Any]:
    """
    Repeat both strategies across many seeds to show the spread, not one draw.

    Cheap now that the mask and its derived indices are cached — the previous
    implementation re-read the NIfTI on every iteration.
    """
    baseline_j, baseline_r, guided_j, guided_r = [], [], [], []

    for i in range(n_iterations):
        base = centroid_strategy(n_passes, seed=1000 + i)
        guided = stratified_strategy(n_passes, seed=2000 + i)
        baseline_j.append(base["evenness"])
        baseline_r.append(base["representativeness"])
        guided_j.append(guided["evenness"])
        guided_r.append(guided["representativeness"])

    def summarise(js: list[float], rs: list[float]) -> dict[str, Any]:
        return {
            "meanEvenness": round(float(np.mean(js)), 4),
            "stdEvenness": round(float(np.std(js)), 4),
            "meanRepresentativeness": round(float(np.mean(rs)), 4),
            "stdRepresentativeness": round(float(np.std(rs)), 4),
            "evennessSamples": [round(float(v), 3) for v in js[:60]],
        }

    return {
        "iterations": n_iterations,
        "passesPerRun": n_passes,
        "baseline": summarise(baseline_j, baseline_r),
        "stratified": summarise(guided_j, guided_r),
    }
