# 🧠 TumourMap - Privacy-Preserving Virtual Biopsy AI

> **Submission for Hackathon Track 2: BEST USE OF GEMMA**  
> *Offline-Capable, Privacy-Preserving Edge AI & Stereotactic Virtual Biopsy Simulator for Neuro-Oncology.*

---

## 🏆 Track 2 Alignment & Value Proposition

| Hackathon Criterion | How TumourMap Delivers |
|---|---|
| **Gemma Open Weights** | Uses **Gemma 2 (2B)** locally through Ollama for privacy-conscious spatial analysis. |
| **Privacy-Preserving Architecture** | Designed around local processing so sensitive image-derived information can remain on the local machine. |
| **Domain Problem** | Explores **intratumour heterogeneity** and the challenge of obtaining representative samples from spatially heterogeneous tumours. |
| **Edge AI** | Uses a compact Gemma model designed for local execution on accessible hardware. |
| **Quantitative Evaluation** | Compares sampling strategies using simulated trajectories and metrics including Shannon Diversity and Pielou's Evenness. |

---

## 🧬 The Biological & Clinical Problem

1. **Intratumour Heterogeneity**: Brain tumours (e.g. Glioblastoma Multiforme) are not biologically uniform. They contain distinct micro-environmental compartments:
   - **Region 1: Necrotic / Non-Enhancing Core (NCR)** — Hypoxic, devitalized tissue with degraded DNA.
   - **Region 2: Peritumoral Infiltration / Edema (ED)** — Migrating glioma cells in brain parenchyma (hyperintense on T2/FLAIR).
   - **Region 3: Active Enhancing Tumour Rim (ET)** — Hypervascular, highly proliferating cells with blood-brain barrier breakdown (enhancing on T1+Gd).
2. **The Sampling Trap**: A stereotactic needle biopsy takes tiny 10–20mm tissue cores. If the neurosurgeon aims for the geometric centroid, **over 70% of the sample is necrotic debris**, causing false-negative next-generation sequencing (NGS) and failed targeted therapies.
3. **TumourMap Solution**: TumourMap simulates thousands of 3D virtual needle biopsies across multi-parametric MRI (T1, T2, FLAIR, T1+contrast), quantifies heterogeneity capture using **Shannon Diversity ($H'$) and Pielou's Evenness ($J'$)**, and leverages **local Gemma** to audit spatial blind spots and formulate multi-target stereotactic protocols.

---

## 🚀 Quickstart & How to Run

### 1. Prerequisites
- Python 3.10+
- [Ollama](https://ollama.com/) with `gemma2:2b`:
  ```bash
  ollama pull gemma2:2b
  ```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Launch Interactive Clinical Dashboard
```bash
streamlit run app.py
```
Open your browser at `http://localhost:8501`.

### 4. (Optional) Run the FastAPI Backend
```bash
uvicorn backend.main:app --reload --port 8000
```
Interactive API documentation available at `http://localhost:8000/docs`.

---

## 📊 Core Features

### 1. 🔬 3D Multi-Modal MRI Explorer
- Multi-parametric MRI visualization (`T1 Pre`, `T1+Gd Post`, `T2`, `FLAIR`) across Axial, Coronal, and Sagittal planes.
- Dynamic alpha-mask overlay showing the 3 distinct biological compartments.
- Interactive 3D WebGL / Plotly pointcloud of tumour voxel geometry.

### 2. 🎯 3D Virtual Biopsy Simulator & Monte Carlo Benchmark
- **3D Stereotactic Needle Modeling**: Realistic entry points on cranial vault, trajectory vectors, and core sample physics along the needle shaft.
- **Strategy Comparison**:
  - *Naive Centroid Biopsy* ($J' \approx 0.51$, heavy necrotic bias)
  - *Random Surface Biopsy*
  - *Gemma-Optimized Multi-Trajectory Biopsy* ($J' \approx 0.92$, **+80% increase in representativeness**)
- **Monte Carlo Simulator**: 100+ stochastic surgical passes quantifying empirical distributions of Shannon diversity.

### 3. 🧠 Offline Gemma 2 Clinical Copilot & Live Chat
- **Spatial Heterogeneity Audit**: Gemma evaluates 3D subregions and explains diagnostic blind spots.
- **Stereotactic Trajectory Protocol**: Gemma generates cranial burr-hole coordinates, needle angles, and target depths.
- **Interactive Clinical Q&A**: Zero-egress conversational AI for neurosurgeons and oncologists.

### 4. 🛡️ Edge Architecture & Privacy Audit
- Visualizes the 100% offline data flow and HIPAA compliance guarantees.

---

## 📐 Mathematical Formulation

### Shannon Diversity Index ($H'$)
$$H' = -\sum_{i=1}^{S} p_i \ln(p_i)$$
Where $p_i$ is the proportion of biopsy tissue cores capturing biological compartment $i$, for $S=3$ subregions.

### Pielou's Evenness Index ($J'$)
$$J' = \frac{H'}{\ln(S)}$$
- **$J' = 1.0$**: Perfect equitability across all tumour clones.
- **$J' < 0.5$**: Pathological sampling bias.

---

## 🎤 3-Minute Hackathon Demo Script (Pitch Guide)

1. **The Hook (0:00 - 0:45)**:
   > *"In neuro-oncology, a biopsy needle takes a tiny core from a massive brain tumour. If you aim for the center, you hit dead necrotic tissue. The patient's genetic report comes back negative for actionable mutations—even though millimeters away, aggressive cancer cells are proliferating. Brain MRI scans contain sensitive patient facial and neural data, so surgeons cannot send these images to cloud AI models."*

2. **The Solution & Gemma Edge AI (0:45 - 1:45)**:
   > *"Enter **TumourMap**. Running completely offline on local hardware with **Google's Gemma 2 open weights**, TumourMap turns multi-parametric MRI into a 3D virtual biopsy proving ground. We simulate thousands of virtual needle trajectories and measure spatial heterogeneity capture with the Shannon Diversity Index."*

3. **Live Demonstration (1:45 - 2:30)**:
   > *"Show Tab 1: 3D multi-modal MRI and the 3 subregions (Necrosis, Edema, Enhancing Rim).  
   > Show Tab 2: Compare the Naive Centroid Biopsy ($J'=0.51$, 70% dead core) against the Gemma-Optimized plan ($J'=0.92$, balanced yield). Rotate the 3D needle trajectories in Plotly!  
   > Show Tab 3: Local Gemma actively reasoning on the 3D spatial voxel coordinates and answering clinical questions in real-time with zero internet connection."*

4. **The Impact (2:30 - 3:00)**:
   > *"TumourMap empowers neurosurgical suites worldwide with private, edge-native spatial intelligence—turning guesswork into mathematically optimal biopsy planning."*

---

## 📁 Repository Structure

```
tumormap/
├── app.py                     # Streamlit Interactive Clinical Dashboard
├── requirements.txt           # Python dependencies
├── README.md                  # Project overview & demo guide
├── view_mri.py                # Standalone Matplotlib MRI viewer
├── backend/
│   ├── imaging.py             # Multi-modal MRI processor & 3D voxel volumetrics
│   ├── simulation.py          # 3D Stereotactic Virtual Biopsy Simulator & Monte Carlo
│   ├── gemma_local.py         # Offline Gemma 2 AI Agent (Ollama runtime)
│   └── main.py                # FastAPI REST endpoints
└── sub-NSK46/                 # Patient NIfTI MRI dataset (MNI152 Space)
    └── anat/
        ├── sub-NSK46_FLAIR.nii.gz
        ├── sub-NSK46_MNI152_tumor-mask.nii.gz
        ├── sub-NSK46_run-01_T1w.nii.gz
        ├── sub-NSK46_run-02_T1w.nii.gz
        └── sub-NSK46_T2w.nii.gz
```

---
*Built with ❤️ for the Google DeepMind & UK AI Agents Lab Hackathon.*

