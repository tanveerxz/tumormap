from pathlib import Path

import nibabel as nib
import numpy as np


DATA_DIR = Path("sub-NSK46") / "anat"
MASK_FILE = DATA_DIR / "sub-NSK46_MNI152_tumor-mask.nii.gz"


def load_mask():
    img = nib.load(MASK_FILE)
    mask = img.get_fdata().astype(np.int16)
    return mask


def normalize_point(point, shape):
    """
    Convert voxel coordinates to 0-1 coordinates
    so the frontend can draw them at any resolution.
    """
    return [
        round(float(point[i] / (shape[i] - 1)), 4)
        for i in range(3)
    ]


def random_baseline_sampling(mask, n_samples=10, seed=42):
    """
    Baseline strategy:
    samples are concentrated around one tumour region.

    This intentionally models a spatially concentrated
    sampling strategy for comparison purposes.
    """

    rng = np.random.default_rng(seed)

    tumour_coords = np.argwhere(mask > 0)

    # Tumour centroid
    centroid = tumour_coords.mean(axis=0)

    # Distance of every tumour voxel from centroid
    distances = np.linalg.norm(
        tumour_coords - centroid,
        axis=1
    )

    # Prefer voxels relatively close to tumour centre
    threshold = np.percentile(distances, 35)

    central_coords = tumour_coords[
        distances <= threshold
    ]

    indices = rng.choice(
        len(central_coords),
        size=n_samples,
        replace=True,
    )

    return central_coords[indices]


def distributed_sampling(mask, n_samples=10, seed=42):
    """
    Distributed strategy:
    divide samples as evenly as possible between
    the segmentation labels.

    This is deterministic algorithmic sampling,
    NOT a clinical recommendation.
    """

    rng = np.random.default_rng(seed)

    labels = [
        int(x)
        for x in np.unique(mask)
        if x != 0
    ]

    samples = []

    base_count = n_samples // len(labels)
    remainder = n_samples % len(labels)

    for i, label in enumerate(labels):

        region_coords = np.argwhere(mask == label)

        count = base_count

        if i < remainder:
            count += 1

        indices = rng.choice(
            len(region_coords),
            size=count,
            replace=True,
        )

        samples.extend(
            region_coords[indices]
        )

    return np.array(samples)


def evaluate_samples(mask, samples):
    """
    Calculate simple quantitative metrics.
    """

    tumour_hits = 0

    labels_hit = []

    sampled_points = []

    shape = mask.shape

    for point in samples:

        x, y, z = [
            int(v)
            for v in point
        ]

        label = int(mask[x, y, z])

        if label > 0:
            tumour_hits += 1
            labels_hit.append(label)

        sampled_points.append(
            {
                "voxel": [x, y, z],
                "normalized": normalize_point(
                    [x, y, z],
                    shape,
                ),
                "region": label,
            }
        )

    tumour_labels = set(
        int(x)
        for x in np.unique(mask)
        if x != 0
    )

    labels_hit_unique = set(labels_hit)

    hit_rate = (
        tumour_hits / len(samples)
        if len(samples)
        else 0
    )

    region_coverage = (
        len(labels_hit_unique)
        / len(tumour_labels)
        if tumour_labels
        else 0
    )

    # How evenly distributed are samples across regions?
    counts = {
        label: labels_hit.count(label)
        for label in tumour_labels
    }

    proportions = np.array(
        [
            counts[label] / max(tumour_hits, 1)
            for label in tumour_labels
        ]
    )

    # 1 = perfectly balanced between regions
    # 0 = extremely concentrated
    ideal = 1 / len(tumour_labels)

    imbalance = np.mean(
        np.abs(proportions - ideal)
    )

    max_imbalance = 2 * (
        1 - ideal
    ) / len(tumour_labels)

    representativeness = max(
        0,
        1 - imbalance / max_imbalance
    )

    return {
        "sample_count": len(samples),

        "tumour_hit_rate": round(
            hit_rate,
            4,
        ),

        "region_coverage": round(
            region_coverage,
            4,
        ),

        "representativeness_score": round(
            float(representativeness),
            4,
        ),

        "regions_hit": sorted(
            labels_hit_unique
        ),

        "region_sample_counts": counts,

        "points": sampled_points,
    }


def run_comparison(n_samples=12):

    mask = load_mask()

    baseline_points = random_baseline_sampling(
        mask,
        n_samples=n_samples,
    )

    distributed_points = distributed_sampling(
        mask,
        n_samples=n_samples,
    )

    baseline = evaluate_samples(
        mask,
        baseline_points,
    )

    distributed = evaluate_samples(
        mask,
        distributed_points,
    )

    return {
        "research_only": True,

        "description": (
            "Computational comparison of synthetic "
            "sampling strategies on an existing "
            "tumour segmentation."
        ),

        "baseline": baseline,

        "distributed": distributed,

        "improvement": {
            "region_coverage": round(
                distributed["region_coverage"]
                - baseline["region_coverage"],
                4,
            ),

            "representativeness": round(
                distributed[
                    "representativeness_score"
                ]
                - baseline[
                    "representativeness_score"
                ],
                4,
            ),
        },
    }


if __name__ == "__main__":

    results = run_comparison(
        n_samples=12
    )

    from pprint import pprint

    pprint(results)