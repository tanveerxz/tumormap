from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.imaging import extract_mask_features
from backend.simulation import run_comparison


app = FastAPI(
    title="TumourMap Research API"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "research-simulation"
    }


@app.get("/case")
def case():
    return {
        "subject": "sub-NSK46",
        "features": extract_mask_features()
    }


@app.get("/simulation")
def simulation(samples: int = 12):
    return run_comparison(n_samples=samples)