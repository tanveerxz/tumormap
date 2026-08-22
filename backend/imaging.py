from pathlib import Path

import nibabel as nib
import numpy as np


DATA_DIR = Path("sub-NSK46") / "anat"

MASK_FILE = DATA_DIR / "sub-NSK46_MNI152_tumor-mask.nii.gz"


def load_mask():
    img = nib.load(MASK_FILE)
    mask = img.get_fdata()

    return img, mask


def extract_mask_features():
    img, mask = load_mask()

    labels = np.unique(mask)

    tumour_mask = mask > 0

    coords = np.argwhere(tumour_mask)

    if len(coords) == 0:
        raise ValueError("No tumour voxels found.")

    # Overall tumour centre
    centroid = coords.mean(axis=0)

    # Bounding box
    bbox_min = coords.min(axis=0)
    bbox_max = coords.max(axis=0)

    # Best axial slice = slice with most tumour voxels
    tumour_per_slice = np.sum(tumour_mask, axis=(0, 1))
    best_slice = int(np.argmax(tumour_per_slice))

    # Physical voxel size
    voxel_sizes_mm = np.array(img.header.get_zooms()[:3])
    voxel_volume_mm3 = float(np.prod(voxel_sizes_mm))

    tumour_voxel_count = int(np.count_nonzero(tumour_mask))
    tumour_volume_cm3 = (
        tumour_voxel_count * voxel_volume_mm3
    ) / 1000.0

    # Per-label information
    regions = []

    for label in labels:
        if label == 0:
            continue

        region_mask = mask == label
        region_coords = np.argwhere(region_mask)

        voxel_count = int(np.count_nonzero(region_mask))

        region_centroid = region_coords.mean(axis=0)

        regions.append(
            {
                "label": int(label),
                "voxel_count": voxel_count,
                "fraction_of_tumour": round(
                    voxel_count / tumour_voxel_count,
                    4,
                ),
                "centroid_voxel": [
                    round(float(x), 2)
                    for x in region_centroid
                ],
            }
        )

    # Normalized centroid for frontend
    shape = np.array(mask.shape)

    centroid_normalized = centroid / (shape - 1)

    return {
        "shape": [int(x) for x in mask.shape],

        "labels": [
            int(x)
            for x in labels
        ],

        "tumour_voxel_count": tumour_voxel_count,

        "tumour_volume_cm3": round(
            float(tumour_volume_cm3),
            2,
        ),

        "centroid_voxel": [
            round(float(x), 2)
            for x in centroid
        ],

        "centroid_normalized": [
            round(float(x), 4)
            for x in centroid_normalized
        ],

        "bounding_box": {
            "min": [
                int(x)
                for x in bbox_min
            ],
            "max": [
                int(x)
                for x in bbox_max
            ],
        },

        "best_axial_slice": best_slice,

        "regions": regions,
    }


if __name__ == "__main__":
    features = extract_mask_features()

    print("=== TUMOUR FEATURES ===")

    for key, value in features.items():
        print(f"{key}: {value}")