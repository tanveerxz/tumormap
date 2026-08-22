"""
Local Gemma integration via Ollama.

Two rules this module holds to:

1. It never pretends. Every response carries `modelRan: true|false`. When
   Ollama is unavailable the caller gets a deterministic summary clearly
   labelled as such — not canned prose dressed up as model output.

2. Gemma is asked to *decide*, not just to narrate. `propose_allocation`
   returns the pass budget the simulation actually runs, so the strategy on
   screen is the model's, and it is validated before use.
"""

from __future__ import annotations

import json
import re
from typing import Any

import requests

OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "gemma2:2b"
TIMEOUT = 60.0

SYSTEM = (
    "You are a neuro-oncology sampling assistant running locally on open weights. "
    "You reason about how to distribute biopsy passes across tumour compartments "
    "so the collected tissue represents the whole mass. You describe simulations, "
    "never patients, and you never give clinical directions."
)


def is_available(model: str = DEFAULT_MODEL) -> dict[str, Any]:
    """Check the local daemon and whether the model is actually pulled."""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2.0)
        if response.status_code != 200:
            return {"available": False, "reason": f"Ollama returned {response.status_code}"}
        names = [m.get("name", "") for m in response.json().get("models", [])]
        pulled = any(n == model or n.startswith(model.split(":")[0]) for n in names)
        return {
            "available": pulled,
            "daemon": True,
            "models": names,
            "reason": None if pulled else f"{model} not pulled (`ollama pull {model}`)",
        }
    except Exception as exc:
        return {"available": False, "daemon": False, "reason": f"Ollama unreachable: {exc}"}


def _generate(prompt: str, model: str = DEFAULT_MODEL, temperature: float = 0.2) -> str | None:
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "system": SYSTEM,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": 600},
            },
            timeout=TIMEOUT,
        )
        if response.status_code == 200:
            return response.json().get("response", "").strip()
    except Exception:
        return None
    return None


def _compartment_brief(features: dict[str, Any]) -> str:
    lines = [
        f"- {r['id']} ({r['short']}): {r['trueShare'] * 100:.1f}% of volume, {r['volumeCm3']} cm3"
        for r in features["regions"]
    ]
    return "\n".join(lines)


def propose_allocation(features: dict[str, Any], n_passes: int, model: str = DEFAULT_MODEL) -> dict[str, Any]:
    """
    Ask Gemma how to spend the pass budget across compartments.

    The model's answer is parsed and validated: ids must be known and counts
    must sum to the budget. Anything else falls back to apportionment by volume
    share, and the response says which happened.
    """
    ids = [r["id"] for r in features["regions"]]
    prompt = f"""A tumour segmentation has these compartments:

{_compartment_brief(features)}

You have {n_passes} simulated biopsy passes to distribute. The goal is that the
collected tissue represents the whole tumour, not just its largest or most
visible compartment.

Reply with ONLY a JSON object mapping compartment id to pass count, using the
ids {ids}. The counts must sum to exactly {n_passes}.
Example: {{"NCR": 4, "ED": 5, "ET": 3}}"""

    raw = _generate(prompt, model=model)
    if raw:
        match = re.search(r"\{[^{}]*\}", raw)
        if match:
            try:
                parsed = json.loads(match.group(0))
                alloc = {k: int(v) for k, v in parsed.items() if k in ids}
                if alloc and sum(alloc.values()) == n_passes:
                    return {
                        "allocation": alloc,
                        "modelRan": True,
                        "model": model,
                        "source": "gemma",
                        "raw": raw,
                    }
            except (ValueError, TypeError):
                pass

    from backend.sampling import allocate_by_share

    return {
        "allocation": allocate_by_share(n_passes),
        "modelRan": False,
        "model": model,
        "source": "volume-share apportionment",
        "reason": is_available(model).get("reason", "model did not return a valid allocation"),
    }


def explain(features: dict[str, Any], comparison: dict[str, Any], model: str = DEFAULT_MODEL) -> dict[str, Any]:
    """Narrate the comparison. Clearly flagged when the model did not run."""
    baseline = comparison["baseline"]
    guided = comparison["stratified"]

    prompt = f"""Tumour compartments:

{_compartment_brief(features)}

Two simulated sampling strategies were compared.

Centroid-targeted: hit rate {baseline['hitRate'] * 100:.0f}%, evenness J' {baseline['evenness']},
representativeness {baseline['representativeness'] * 100:.0f}%, compartments reached {baseline['regionsTouched']}/3,
sampled mix {baseline['sampledShare']}.

Compartment-stratified: hit rate {guided['hitRate'] * 100:.0f}%, evenness J' {guided['evenness']},
representativeness {guided['representativeness'] * 100:.0f}%, compartments reached {guided['regionsTouched']}/3,
sampled mix {guided['sampledShare']}.

In 3 short paragraphs: what the centroid strategy misses and why that matters
biologically; what changed under stratification; and one honest limitation of
this simulation. Describe the simulation, not any patient."""

    raw = _generate(prompt, model=model, temperature=0.3)
    if raw:
        return {"text": raw, "modelRan": True, "model": model}

    missed = [rid for rid, share in baseline["sampledShare"].items() if share == 0]
    missed_text = (
        f"It drew nothing at all from {', '.join(missed)}."
        if missed
        else "It drew unevenly across compartments."
    )
    return {
        "text": (
            f"Centroid targeting reached {baseline['regionsTouched']} of 3 compartments "
            f"(evenness J' {baseline['evenness']}). {missed_text} Stratifying passes across "
            f"compartments raised evenness to {guided['evenness']} and representativeness from "
            f"{baseline['representativeness'] * 100:.0f}% to {guided['representativeness'] * 100:.0f}%, "
            f"while the hit rate barely moved — reaching tumour was never the hard part. "
            f"Limitation: entry geometry is a stand-in, and the segmentation's label semantics "
            f"are assumed rather than confirmed by a dataset description."
        ),
        "modelRan": False,
        "model": model,
        "reason": is_available(model).get("reason"),
    }
