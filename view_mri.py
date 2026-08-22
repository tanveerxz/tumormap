from pathlib import Path
import json

import nibabel as nib
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider


# -----------------------------
# Paths
# -----------------------------

DATA_DIR = Path("sub-NSK46") / "anat"

FILES = {
    "FLAIR": DATA_DIR / "sub-NSK46_FLAIR.nii.gz",
    "T1 run 01": DATA_DIR / "sub-NSK46_run-01_T1w.nii.gz",
    "T1 run 02": DATA_DIR / "sub-NSK46_run-02_T1w.nii.gz",
    "T2": DATA_DIR / "sub-NSK46_T2w.nii.gz",
}


# -----------------------------
# Load MRI volumes
# -----------------------------

volumes = {}

for name, path in FILES.items():
    img = nib.load(path)
    data = img.get_fdata()

    volumes[name] = data

    print(f"{name}")
    print(f"  path: {path}")
    print(f"  shape: {data.shape}")
    print(f"  min/max: {data.min():.2f} / {data.max():.2f}")
    print()


# -----------------------------
# Look at T1 metadata
# -----------------------------

for run in ["01", "02"]:
    json_path = DATA_DIR / f"sub-NSK46_run-{run}_T1w.json"

    if json_path.exists():
        with open(json_path, "r") as f:
            metadata = json.load(f)

        print(f"\nT1 run-{run} metadata")
        print("SeriesDescription:", metadata.get("SeriesDescription"))
        print("ProtocolName:", metadata.get("ProtocolName"))
        print("ContrastBolusIngredient:", metadata.get("ContrastBolusIngredient"))


# -----------------------------
# Normalise images for display
# -----------------------------

def display_normalize(image):
    """
    Ignore extreme intensity values so MRI contrast
    looks better on screen.
    """

    nonzero = image[image > 0]

    if len(nonzero) == 0:
        return image

    low = np.percentile(nonzero, 1)
    high = np.percentile(nonzero, 99)

    image = np.clip(image, low, high)

    return (image - low) / (high - low + 1e-8)


normalised = {
    name: display_normalize(volume)
    for name, volume in volumes.items()
}


# -----------------------------
# Interactive viewer
# -----------------------------

fig, axes = plt.subplots(2, 2, figsize=(10, 10))

plt.subplots_adjust(bottom=0.12)

axes = axes.flatten()

images = []

# Slider represents 0–100% through each MRI,
# so it still works if depths differ slightly.

starting_position = 50

for ax, (name, volume) in zip(axes, normalised.items()):

    z = int(
        (starting_position / 100)
        * (volume.shape[2] - 1)
    )

    image = ax.imshow(
        volume[:, :, z].T,
        cmap="gray",
        origin="lower"
    )

    ax.set_title(f"{name} — slice {z}")
    ax.axis("off")

    images.append((name, image, ax))


# Slider
slider_ax = plt.axes([0.2, 0.04, 0.6, 0.03])

slice_slider = Slider(
    slider_ax,
    "Brain position",
    0,
    100,
    valinit=starting_position,
    valstep=1
)


def update(value):

    percentage = value / 100

    for name, image, ax in images:

        volume = normalised[name]

        z = int(
            percentage
            * (volume.shape[2] - 1)
        )

        image.set_data(volume[:, :, z].T)

        ax.set_title(
            f"{name} — slice {z}"
        )

    fig.canvas.draw_idle()


slice_slider.on_changed(update)

plt.suptitle(
    "TumourMap — sub-NSK46",
    fontsize=16
)

plt.show()