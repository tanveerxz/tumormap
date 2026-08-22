import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import nibabel as nib
import numpy as np

DATA_DIR = Path("sub-NSK46") / "anat"
MASK_FILE = DATA_DIR / "sub-NSK46_MNI152_tumor-mask.nii.gz"

MRI_FILES = {
    "FLAIR": DATA_DIR / "sub-NSK46_FLAIR.nii.gz",
    "T1_pre": DATA_DIR / "sub-NSK46_run-01_T1w.nii.gz",
    "T1_contrast": DATA_DIR / "sub-NSK46_run-02_T1w.nii.gz",
    "T2": DATA_DIR / "sub-NSK46_T2w.nii.gz",
}

SUBREGION_INFO = {
    1: {
        "name": "Necrotic / Non-Enhancing Core",
        "short_name": "Necrosis (NCR)",
        "color": "#e74c3c",  # Red
        "clinical_significance": "Hypoxic, non-viable core. High DNA degradation; unrepresentative for molecular profiling if sampled exclusively."
    },
    2: {
        "name": "Peritumoral Infiltration / Edema",
        "short_name": "Edema/Infiltration (ED)",
        "color": "#3498db",  # Blue
        "clinical_significance": "Invasive tumor margin with migrating glioma cells. Key for defining surgical resection margins and radiation fields."
    },
    3: {
        "name": "Active Enhancing Tumour Rim",
        "short_name": "Enhancing Tumour (ET)",
        "color": "#2ecc71",  # Green
        "clinical_significance": "Hypervascular, highly proliferative cells with blood-brain barrier breakdown. Critical target for targeted therapy & NGS."
    }
}


def load_mask():
    """Load the 3D segmentation mask."""
    img = nib.load(MASK_FILE)
    mask = img.get_fdata().astype(np.int16)
    return img, mask


def load_mri_volume(modality: str = "T1_contrast"):
    """Load a specific MRI modality volume."""
    file_path = MRI_FILES.get(modality, MRI_FILES["T1_contrast"])
    if not file_path.exists():
        file_path = MRI_FILES["FLAIR"]
    img = nib.load(file_path)
    data = img.get_fdata()
    return img, data


def normalize_for_display(image):
    """Percentile clip and normalize image for display."""
    nonzero = image[image > 0]
    if len(nonzero) == 0:
        return image
    low = np.percentile(nonzero, 1)
    high = np.percentile(nonzero, 99)
    clipped = np.clip(image, low, high)
    return (clipped - low) / (high - low + 1e-8)


def extract_mask_features():
    """Extract volumetric, spatial, and subregion features for clinical & AI reasoning."""
    img, mask = load_mask()
    labels = np.unique(mask)
    tumour_mask = mask > 0
    coords = np.argwhere(tumour_mask)

    if len(coords) == 0:
        raise ValueError("No tumour voxels found in segmentation mask.")

    centroid = coords.mean(axis=0)
    bbox_min = coords.min(axis=0)
    bbox_max = coords.max(axis=0)

    # Physical voxel volume
    voxel_sizes_mm = np.array(img.header.get_zooms()[:3])
    voxel_volume_mm3 = float(np.prod(voxel_sizes_mm))
    tumour_voxel_count = int(np.count_nonzero(tumour_mask))
    tumour_volume_cm3 = (tumour_voxel_count * voxel_volume_mm3) / 1000.0

    # Best slices (slice with maximum tumour cross-section)
    tumour_per_axial = np.sum(tumour_mask, axis=(0, 1))
    best_axial = int(np.argmax(tumour_per_axial))

    tumour_per_coronal = np.sum(tumour_mask, axis=(0, 2))
    best_coronal = int(np.argmax(tumour_per_coronal))

    tumour_per_sagittal = np.sum(tumour_mask, axis=(1, 2))
    best_sagittal = int(np.argmax(tumour_per_sagittal))

    # Per-label subregion analysis
    regions = []
    for label in [1, 2, 3]:
        region_mask = mask == label
        region_coords = np.argwhere(region_mask)
        voxel_count = int(np.count_nonzero(region_mask))
        
        if voxel_count > 0:
            reg_centroid = region_coords.mean(axis=0)
            fraction = voxel_count / tumour_voxel_count
            vol_cm3 = (voxel_count * voxel_volume_mm3) / 1000.0
            info = SUBREGION_INFO.get(label, {})
            regions.append({
                "label": int(label),
                "name": info.get("name", f"Region {label}"),
                "short_name": info.get("short_name", f"R{label}"),
                "color": info.get("color", "#ffffff"),
                "clinical_significance": info.get("clinical_significance", ""),
                "voxel_count": voxel_count,
                "volume_cm3": round(float(vol_cm3), 2),
                "fraction_of_tumour": round(float(fraction), 4),
                "centroid_voxel": [round(float(x), 2) for x in reg_centroid],
            })

    shape = np.array(mask.shape)
    centroid_normalized = centroid / (shape - 1)

    return {
        "subject_id": "sub-NSK46",
        "shape": [int(x) for x in mask.shape],
        "voxel_size_mm": [round(float(x), 2) for x in voxel_sizes_mm],
        "tumour_voxel_count": tumour_voxel_count,
        "tumour_volume_cm3": round(float(tumour_volume_cm3), 2),
        "centroid_voxel": [round(float(x), 2) for x in centroid],
        "centroid_normalized": [round(float(x), 4) for x in centroid_normalized],
        "bounding_box": {
            "min": [int(x) for x in bbox_min],
            "max": [int(x) for x in bbox_max],
        },
        "best_slices": {
            "axial": best_axial,
            "coronal": best_coronal,
            "sagittal": best_sagittal,
        },
        "regions": regions,
    }


def get_3d_pointcloud_samples(max_points_per_region: int = 350):
    """
    Subsample 3D coordinates for interactive 3D WebGL / Plotly rendering.
    """
    _, mask = load_mask()
    points = []
    
    for label in [1, 2, 3]:
        coords = np.argwhere(mask == label)
        if len(coords) == 0:
            continue
        if len(coords) > max_points_per_region:
            step = len(coords) // max_points_per_region
            coords = coords[::step][:max_points_per_region]
            
        info = SUBREGION_INFO.get(label, {})
        for pt in coords:
            points.append({
                "x": int(pt[0]),
                "y": int(pt[1]),
                "z": int(pt[2]),
                "label": int(label),
                "region_name": info.get("short_name", f"Region {label}"),
                "color": info.get("color", "#cccccc"),
            })
            
    return points


if __name__ == "__main__":
    features = extract_mask_features()
    print("=== TUMOUR FEATURES ===")
    print(json.dumps(features, indent=2))