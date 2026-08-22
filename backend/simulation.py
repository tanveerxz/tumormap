import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import math
import numpy as np
import nibabel as nib
from backend.imaging import load_mask, SUBREGION_INFO, extract_mask_features

DATA_DIR = Path("sub-NSK46") / "anat"
MASK_FILE = DATA_DIR / "sub-NSK46_MNI152_tumor-mask.nii.gz"


def normalize_point(point, shape):
    """Convert voxel coordinates [x, y, z] to normalized [0, 1] space."""
    return [
        round(float(point[i] / (shape[i] - 1)), 4)
        for i in range(3)
    ]


def shannon_diversity_index(counts, num_classes=3):
    """
    Compute Shannon Diversity Index (H') and Pielou's Evenness (J').
    H' = - sum(p_i * ln(p_i))
    J' = H' / ln(num_classes)
    """
    total = sum(counts.values())
    if total == 0:
        return 0.0, 0.0
    
    h_prime = 0.0
    for count in counts.values():
        if count > 0:
            p = count / total
            h_prime -= p * math.log(p)
            
    max_h = math.log(num_classes) if num_classes > 1 else 1.0
    evenness = h_prime / max_h if max_h > 0 else 0.0
    return round(float(h_prime), 4), round(float(evenness), 4)


def simulate_needle_trajectory(mask, entry_point, target_point, num_cores=5, core_step=3.0):
    """
    Simulate a 3D stereotactic needle trajectory from cranial entry to target.
    Extracts samples along the distal needle track around the target point.
    """
    entry = np.array(entry_point, dtype=float)
    target = np.array(target_point, dtype=float)
    direction = target - entry
    length = np.linalg.norm(direction)
    
    if length == 0:
        unit_dir = np.array([0, 0, 1])
    else:
        unit_dir = direction / length

    # Sample cores along needle axis around target
    # e.g., steps: -2*step, -1*step, 0, +1*step, +2*step
    offsets = np.linspace(- (num_cores // 2) * core_step, (num_cores // 2) * core_step, num_cores)
    
    samples = []
    shape = mask.shape
    
    for offset in offsets:
        pt = target + offset * unit_dir
        # Clamp to volume bounds
        vx = int(np.clip(round(pt[0]), 0, shape[0] - 1))
        vy = int(np.clip(round(pt[1]), 0, shape[1] - 1))
        vz = int(np.clip(round(pt[2]), 0, shape[2] - 1))
        
        label = int(mask[vx, vy, vz])
        samples.append({
            "voxel": [vx, vy, vz],
            "normalized": normalize_point([vx, vy, vz], shape),
            "label": label,
            "region_info": SUBREGION_INFO.get(label, {"short_name": "Non-Tumour/Healthy", "color": "#7f8c8d"}),
            "depth_mm": round(float(length + offset), 2)
        })
        
    return {
        "entry_voxel": [int(round(x)) for x in entry],
        "target_voxel": [int(round(x)) for x in target],
        "length_mm": round(float(length), 2),
        "samples": samples
    }


def naive_centroid_strategy(mask, n_samples=12, seed=42):
    """
    Baseline Strategy: Standard naive single-trajectory biopsy aiming for tumour centroid.
    Demonstrates severe necrotic core over-sampling.
    """
    rng = np.random.default_rng(seed)
    features = extract_mask_features()
    centroid = np.array(features["centroid_voxel"])
    
    # Cranial entry point on superior/lateral skull surface
    shape = mask.shape
    entry_point = np.array([centroid[0] + 40, centroid[1] - 50, shape[2] - 10])
    
    # Single needle path with multiple core samples along the central axis
    # plus slight surgical angular jitter
    trajectories = []
    all_samples = []
    
    samples_per_track = max(3, n_samples // 2)
    num_tracks = math.ceil(n_samples / samples_per_track)
    
    for t_idx in range(num_tracks):
        # Aimed directly at or near centroid
        jitter = rng.normal(0, 3.0, size=3)
        target = centroid + jitter
        traj = simulate_needle_trajectory(mask, entry_point, target, num_cores=samples_per_track, core_step=3.5)
        trajectories.append(traj)
        all_samples.extend(traj["samples"])
        
    return {
        "name": "Traditional Centroid-Targeted Biopsy",
        "description": "Standard stereotactic single-focus trajectory directed at the geometric tumour centroid. High risk of sampling non-viable necrotic debris.",
        "trajectories": trajectories,
        "samples": all_samples[:n_samples]
    }


def random_surface_strategy(mask, n_samples=12, seed=42):
    """
    Random surface strategy: unguided cranial entry points.
    """
    rng = np.random.default_rng(seed)
    tumour_coords = np.argwhere(mask > 0)
    shape = mask.shape
    
    trajectories = []
    all_samples = []
    num_tracks = 3
    cores_per_track = math.ceil(n_samples / num_tracks)
    
    for _ in range(num_tracks):
        # Random surface entry
        entry = np.array([
            rng.uniform(10, shape[0] - 10),
            rng.uniform(10, shape[1] - 10),
            shape[2] - 15
        ])
        # Random target near tumour
        rand_idx = rng.integers(0, len(tumour_coords))
        target = tumour_coords[rand_idx] + rng.normal(0, 8, size=3)
        
        traj = simulate_needle_trajectory(mask, entry, target, num_cores=cores_per_track, core_step=4.0)
        trajectories.append(traj)
        all_samples.extend(traj["samples"])
        
    return {
        "name": "Random Surface Entry Biopsy",
        "description": "Simulates unguided or sub-optimally angulated needle passes with high miss rate and variable tissue yield.",
        "trajectories": trajectories,
        "samples": all_samples[:n_samples]
    }


def gemma_optimized_strategy(mask, n_samples=12, seed=42):
    """
    Gemma-Optimized Multi-Trajectory Strategy:
    Multi-target stereotactic planning designed to capture:
    - Target 1: Enhancing active rim (Label 3)
    - Target 2: Invasive peritumoral edema (Label 2)
    - Target 3: Core (Label 1)
    Max-entropy balanced spatial sampling.
    """
    rng = np.random.default_rng(seed)
    shape = mask.shape
    
    # Calculate subregion centroids
    targets = []
    for label in [3, 2, 1]:  # Prioritize Enhancing (3) -> Infiltration (2) -> Necrosis (1)
        coords = np.argwhere(mask == label)
        if len(coords) > 0:
            targets.append((label, coords.mean(axis=0)))
            
    trajectories = []
    all_samples = []
    
    samples_per_target = n_samples // len(targets)
    remainder = n_samples % len(targets)
    
    # Entry point optimized for multi-trajectory access (e.g. single burr hole or minimal craniotomy)
    cranial_entry = np.array([shape[0] * 0.45, shape[1] * 0.35, shape[2] - 15])
    
    for i, (label, target_coord) in enumerate(targets):
        count = samples_per_target + (1 if i < remainder else 0)
        # Trajectory with minimal tissue shearing
        jitter = rng.normal(0, 1.2, size=3)
        target = target_coord + jitter
        
        traj = simulate_needle_trajectory(mask, cranial_entry, target, num_cores=count, core_step=3.0)
        trajectories.append(traj)
        all_samples.extend(traj["samples"])
        
    return {
        "name": "Gemma-Optimized Heterogeneity Biopsy",
        "description": "Multi-target stereotactic strategy proposed by local Gemma. Strategically angulates trajectories from a shared cranial portal to sample Active Enhancing Margin (R3), Infiltration (R2), and Core (R1).",
        "trajectories": trajectories,
        "samples": all_samples[:n_samples]
    }


def evaluate_biopsy_strategy(strategy_result, num_classes=3):
    """
    Compute comprehensive clinical & quantitative metrics for a biopsy strategy.
    """
    samples = strategy_result["samples"]
    total_samples = len(samples)
    
    tumour_hits = 0
    region_counts = {1: 0, 2: 0, 3: 0}
    
    for s in samples:
        lbl = s["label"]
        if lbl in region_counts:
            region_counts[lbl] += 1
            tumour_hits += 1
            
    hit_rate = tumour_hits / total_samples if total_samples > 0 else 0.0
    regions_hit = [lbl for lbl, c in region_counts.items() if c > 0]
    coverage = len(regions_hit) / num_classes
    
    h_prime, evenness = shannon_diversity_index(region_counts, num_classes=num_classes)
    
    # Necrosis over-sampling ratio
    necrosis_fraction = region_counts[1] / tumour_hits if tumour_hits > 0 else 0.0
    active_fraction = region_counts[3] / tumour_hits if tumour_hits > 0 else 0.0
    edema_fraction = region_counts[2] / tumour_hits if tumour_hits > 0 else 0.0
    
    return {
        "strategy_name": strategy_result["name"],
        "description": strategy_result["description"],
        "total_samples": total_samples,
        "tumour_hits": tumour_hits,
        "tumour_hit_rate": round(hit_rate, 4),
        "hit_rate_pct": f"{round(hit_rate * 100, 1)}%",
        "region_coverage": round(coverage, 4),
        "region_coverage_pct": f"{round(coverage * 100, 1)}%",
        "regions_hit": sorted(regions_hit),
        "region_counts": region_counts,
        "proportions": {
            "necrosis_pct": round(necrosis_fraction * 100, 1),
            "edema_pct": round(edema_fraction * 100, 1),
            "enhancing_pct": round(active_fraction * 100, 1),
        },
        "shannon_diversity_index": h_prime,
        "pielou_evenness_index": evenness,
        "trajectories": strategy_result["trajectories"],
        "samples": samples
    }


def run_monte_carlo_simulation(mask, n_iterations=200, n_samples=12):
    """
    Run Monte Carlo virtual biopsy simulation comparing Baseline vs Gemma-Optimized across hundreds of runs.
    """
    baseline_h_list = []
    baseline_evenness_list = []
    baseline_coverage_list = []
    baseline_hit_rates = []
    
    gemma_h_list = []
    gemma_evenness_list = []
    gemma_coverage_list = []
    gemma_hit_rates = []
    
    for i in range(n_iterations):
        # Baseline
        base_strat = naive_centroid_strategy(mask, n_samples=n_samples, seed=1000 + i)
        base_eval = evaluate_biopsy_strategy(base_strat)
        baseline_h_list.append(base_eval["shannon_diversity_index"])
        baseline_evenness_list.append(base_eval["pielou_evenness_index"])
        baseline_coverage_list.append(base_eval["region_coverage"])
        baseline_hit_rates.append(base_eval["tumour_hit_rate"])
        
        # Gemma-Optimized
        gem_strat = gemma_optimized_strategy(mask, n_samples=n_samples, seed=2000 + i)
        gem_eval = evaluate_biopsy_strategy(gem_strat)
        gemma_h_list.append(gem_eval["shannon_diversity_index"])
        gemma_evenness_list.append(gem_eval["pielou_evenness_index"])
        gemma_coverage_list.append(gem_eval["region_coverage"])
        gemma_hit_rates.append(gem_eval["tumour_hit_rate"])
        
    return {
        "iterations": n_iterations,
        "samples_per_run": n_samples,
        "baseline": {
            "mean_shannon_diversity": round(float(np.mean(baseline_h_list)), 4),
            "std_shannon_diversity": round(float(np.std(baseline_h_list)), 4),
            "mean_evenness": round(float(np.mean(baseline_evenness_list)), 4),
            "mean_coverage": round(float(np.mean(baseline_coverage_list)), 4),
            "mean_hit_rate": round(float(np.mean(baseline_hit_rates)), 4),
            "distribution_evenness": [round(float(x), 3) for x in baseline_evenness_list[:50]],
        },
        "gemma_optimized": {
            "mean_shannon_diversity": round(float(np.mean(gemma_h_list)), 4),
            "std_shannon_diversity": round(float(np.std(gemma_h_list)), 4),
            "mean_evenness": round(float(np.mean(gemma_evenness_list)), 4),
            "mean_coverage": round(float(np.mean(gemma_coverage_list)), 4),
            "mean_hit_rate": round(float(np.mean(gemma_hit_rates)), 4),
            "distribution_evenness": [round(float(x), 3) for x in gemma_evenness_list[:50]],
        },
        "gain": {
            "evenness_improvement": round(float(np.mean(gemma_evenness_list) - np.mean(baseline_evenness_list)), 4),
            "coverage_improvement_pct": round(float((np.mean(gemma_coverage_list) - np.mean(baseline_coverage_list)) * 100), 1),
            "shannon_entropy_gain": round(float(np.mean(gemma_h_list) - np.mean(baseline_h_list)), 4),
        }
    }


def run_comparison(n_samples=12):
    """Comprehensive single-run comparison across 3 strategies."""
    _, mask = load_mask()
    
    baseline = evaluate_biopsy_strategy(naive_centroid_strategy(mask, n_samples=n_samples))
    random_strat = evaluate_biopsy_strategy(random_surface_strategy(mask, n_samples=n_samples))
    gemma_opt = evaluate_biopsy_strategy(gemma_optimized_strategy(mask, n_samples=n_samples))
    
    return {
        "baseline_centroid": baseline,
        "random_surface": random_strat,
        "gemma_optimized": gemma_opt,
        "heterogeneity_gain": {
            "evenness_delta": round(gemma_opt["pielou_evenness_index"] - baseline["pielou_evenness_index"], 4),
            "coverage_delta": round(gemma_opt["region_coverage"] - baseline["region_coverage"], 4),
            "shannon_gain": round(gemma_opt["shannon_diversity_index"] - baseline["shannon_diversity_index"], 4),
        }
    }


if __name__ == "__main__":
    res = run_comparison(n_samples=12)
    print("=== STRATEGY COMPARISON ===")
    print(f"Baseline Evenness: {res['baseline_centroid']['pielou_evenness_index']}")
    print(f"Gemma-Opt Evenness: {res['gemma_optimized']['pielou_evenness_index']}")
    print(f"Gain: {res['heterogeneity_gain']}")