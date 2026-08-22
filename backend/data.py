"""
Cached access to the imaging data, plus the derived geometry the client needs.

Two things this fixes over loading ad hoc:

1. `imaging.extract_mask_features()` re-reads the mask from disk on every call,
   and the Monte Carlo loop calls it once per iteration. At ~0.27 s a load that
   is ~27 s for a 100-iteration run. Everything here is cached per process.

2. The tumour mask and the MRI volumes DO NOT SHARE A COORDINATE SPACE. The
   mask is MNI152 (182x218x182, 1 mm isotropic); every scan is native scanner
   space with its own shape and affine. They cannot be overlaid by indexing,
   and the inverse warp needed to bring the mask into native space was never
   published with the data. So this module deliberately keeps them apart:
   mask-derived geometry is served in mask space, MRI slices are served as
   standalone images, and the client labels them as unregistered.
"""

from __future__ import annotations

import base64
import functools
import io
import json
from pathlib import Path
from typing import Any

import nibabel as nib
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "sub-NSK46" / "anat"
MASK_FILE = DATA_DIR / "sub-NSK46_MNI152_tumor-mask.nii.gz"

MRI_FILES = {
    "FLAIR": DATA_DIR / "sub-NSK46_FLAIR.nii.gz",
    "T1_pre": DATA_DIR / "sub-NSK46_run-01_T1w.nii.gz",
    "T1_post": DATA_DIR / "sub-NSK46_run-02_T1w.nii.gz",
    "T2": DATA_DIR / "sub-NSK46_T2w.nii.gz",
}

SUBJECT_ID = "sub-NSK46"

# Label semantics follow the segmentation's own 1/2/3 encoding. NOTE: this is
# the conventional reading, but it is an assumption — the BraTS convention uses
# label 4 for enhancing tumour, not 3, and no dataset_description.json shipped
# with the data to confirm. Treated as provisional and surfaced as such.
REGIONS: dict[int, dict[str, str]] = {
    1: {
        "id": "NCR",
        "name": "Necrotic / non-enhancing core",
        "short": "Necrotic tissue",
        "note": "Hypoxic, non-viable tissue with degraded DNA. Sampling here alone yields poor molecular profiling.",
    },
    2: {
        "id": "ED",
        "name": "Peritumoral infiltration / edema",
        "short": "Infiltrative tissue",
        "note": "Invasive margin with migrating glioma cells. Defines resection margins and radiation fields.",
    },
    3: {
        "id": "ET",
        "name": "Active enhancing rim",
        "short": "Enhancing tissue",
        "note": "Hypervascular, highly proliferative cells. The critical target for targeted therapy and sequencing.",
    },
}

LABELS = [1, 2, 3]


@functools.lru_cache(maxsize=1)
def load_mask() -> tuple[np.ndarray, np.ndarray, tuple[float, float, float]]:
    """Return (mask array, affine, voxel sizes in mm). Cached for the process."""
    img = nib.load(MASK_FILE)
    mask = np.asarray(img.dataobj).astype(np.int16)
    zooms = tuple(float(z) for z in img.header.get_zooms()[:3])
    return mask, img.affine, zooms


@functools.lru_cache(maxsize=1)
def mask_features() -> dict[str, Any]:
    """Volumetric and spatial summary of the segmentation, computed once."""
    mask, _, zooms = load_mask()
    voxel_volume_mm3 = float(np.prod(zooms))

    tumour = mask > 0
    tumour_voxels = int(tumour.sum())
    if tumour_voxels == 0:
        raise ValueError("Segmentation contains no tumour voxels.")

    coords = np.argwhere(tumour)
    centroid = coords.mean(axis=0)

    regions = []
    for label in LABELS:
        region = mask == label
        count = int(region.sum())
        if count == 0:
            continue
        rc = np.argwhere(region).mean(axis=0)
        meta = REGIONS[label]
        regions.append(
            {
                "label": label,
                "id": meta["id"],
                "name": meta["name"],
                "short": meta["short"],
                "note": meta["note"],
                "voxels": count,
                "volumeCm3": round(count * voxel_volume_mm3 / 1000.0, 2),
                "trueShare": round(count / tumour_voxels, 4),
                "centroid": [round(float(v), 2) for v in rc],
            }
        )

    return {
        "subjectId": SUBJECT_ID,
        "space": "MNI152",
        "shape": [int(v) for v in mask.shape],
        "voxelSizeMm": [round(float(z), 2) for z in zooms],
        "tumourVoxels": tumour_voxels,
        "tumourVolumeCm3": round(tumour_voxels * voxel_volume_mm3 / 1000.0, 2),
        "centroid": [round(float(v), 2) for v in centroid],
        "regions": regions,
    }


@functools.lru_cache(maxsize=1)
def region_voxel_index() -> dict[int, np.ndarray]:
    """Voxel coordinates per label, cached — used for stratified targeting."""
    mask, _, _ = load_mask()
    return {label: np.argwhere(mask == label) for label in LABELS}


@functools.lru_cache(maxsize=8)
def point_cloud(max_per_region: int = 1400) -> dict[str, Any]:
    """
    Subsampled 3D surface points per region, normalised to a unit cube centred
    on the origin, for client-side rendering.

    Interior voxels are invisible from outside, so this keeps only surface
    voxels — a voxel with at least one non-matching 6-neighbour. That cuts the
    payload hard and makes the render read as a solid body rather than fog.
    """
    mask, _, zooms = load_mask()
    shape = np.array(mask.shape, dtype=float)
    rng = np.random.default_rng(7)

    regions: list[dict[str, Any]] = []
    for label in LABELS:
        solid = mask == label
        if not solid.any():
            continue

        # Surface = voxels in the region that touch something outside it.
        interior = (
            np.roll(solid, 1, 0)
            & np.roll(solid, -1, 0)
            & np.roll(solid, 1, 1)
            & np.roll(solid, -1, 1)
            & np.roll(solid, 1, 2)
            & np.roll(solid, -1, 2)
        )
        coords = np.argwhere(solid & ~interior)

        if len(coords) > max_per_region:
            pick = rng.choice(len(coords), size=max_per_region, replace=False)
            coords = coords[pick]

        # Normalise into [-0.5, 0.5] and scale by physical voxel size so the
        # proportions are anatomically right, not grid-distorted.
        scaled = (coords / shape - 0.5) * np.array(zooms) * shape / shape.max()

        regions.append(
            {
                "label": label,
                "id": REGIONS[label]["id"],
                "points": [[round(float(v), 4) for v in p] for p in scaled],
            }
        )

    return {"space": "MNI152", "regions": regions}


def _window(volume: np.ndarray) -> np.ndarray:
    """Percentile-clip to 0..1 so MRI contrast is readable on screen."""
    nonzero = volume[volume > 0]
    if nonzero.size == 0:
        return np.zeros_like(volume, dtype=np.float32)
    lo, hi = np.percentile(nonzero, [1, 99])
    return np.clip((volume - lo) / (hi - lo + 1e-8), 0, 1).astype(np.float32)


@functools.lru_cache(maxsize=8)
def mri_slice(modality: str = "T1_post", plane: str = "axial") -> dict[str, Any]:
    """
    One representative slice of a native-space scan, as a grayscale byte array.

    Served WITHOUT any mask overlay, and tagged with its own space, because the
    segmentation cannot be registered onto it with the data available.
    """
    path = MRI_FILES.get(modality)
    if path is None or not path.exists():
        raise FileNotFoundError(f"Unknown or missing modality: {modality}")

    img = nib.load(path)
    volume = np.asarray(img.dataobj, dtype=np.float32)
    axis = {"sagittal": 0, "coronal": 1, "axial": 2}[plane]

    # Brightest slice is a decent proxy for "most tissue in frame".
    totals = volume.sum(axis=tuple(i for i in range(3) if i != axis))
    index = int(np.argmax(totals))
    plane_data = np.take(volume, index, axis=axis)

    windowed = _window(plane_data)
    # Radiological convention: flip so superior is up.
    windowed = np.flipud(windowed.T)
    as_bytes = (windowed * 255).astype(np.uint8)

    # Encode as a grayscale PNG rather than a JSON array of integers. The array
    # form spent ~4 characters per byte and made a single slice ~480 kB on the
    # wire; PNG brings the same pixels under 60 kB, which matters as soon as
    # the page is opened from anywhere other than this machine.
    buffer = io.BytesIO()
    Image.fromarray(as_bytes, mode="L").save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    return {
        "modality": modality,
        "plane": plane,
        "sliceIndex": index,
        "space": "native",
        "registeredToMask": False,
        "width": int(as_bytes.shape[1]),
        "height": int(as_bytes.shape[0]),
        "png": f"data:image/png;base64,{encoded}",
    }


@functools.lru_cache(maxsize=1)
def acquisition_metadata() -> dict[str, Any]:
    """Scanner details from the BIDS sidecars, for the provenance panel."""
    sidecar = DATA_DIR / "sub-NSK46_run-02_T1w.json"
    if not sidecar.exists():
        return {}
    meta = json.loads(sidecar.read_text())
    return {
        "manufacturer": meta.get("Manufacturer"),
        "model": meta.get("ManufacturersModelName"),
        "fieldStrengthT": meta.get("MagneticFieldStrength"),
        "sequence": meta.get("SeriesDescription"),
    }
