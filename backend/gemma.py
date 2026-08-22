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
import os
import re
from typing import Any

import requests

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

# Gemma 4 (Apache 2.0, April 2026). The E-series are the edge builds — E4B is
# the larger of the two and still runs comfortably on a laptop, which is the
# whole point of keeping inference local. Override with GEMMA_MODEL to try
# another size (e2b for lower memory, 12b/26b/31b on a workstation).
DEFAULT_MODEL = os.environ.get("GEMMA_MODEL", "gemma4:e4b")
TIMEOUT = float(os.environ.get("GEMMA_TIMEOUT", "300"))

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
        # Require the exact tag. Only when the caller names a bare family
        # ("gemma4") does any tag within it count. Matching on the family
        # prefix unconditionally would let a stale gemma2 pull satisfy a
        # gemma4 requirement — precisely the drift worth catching.
        if ":" in model:
            pulled = model in names
        else:
            pulled = any(n.split(":")[0] == model for n in names)
        return {
            "available": pulled,
            "daemon": True,
            "models": names,
            "reason": None if pulled else f"{model} not pulled (`ollama pull {model}`)",
        }
    except Exception as exc:
        return {"available": False, "daemon": False, "reason": f"Ollama unreachable: {exc}"}


def _generate(
    prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    max_tokens: int = 400,
) -> str | None:
    """Generate locally. `max_tokens` is sized per call — a JSON allocation
    needs a few dozen tokens, and letting it run to a prose-length budget was
    costing tens of seconds per request for nothing."""
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "system": SYSTEM,
                "stream": False,
                # Gemma 4 is a reasoner and thinks before answering. Left on,
                # it spends the whole token budget on its reasoning trace and
                # returns an EMPTY response — the allocation call was silently
                # falling back to the deterministic plan every time. Neither
                # task here benefits from a visible reasoning trace, so it is
                # off: the JSON arrives in ~20 tokens instead of ~257.
                "think": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
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


def _repair_to_budget(weights: dict[str, int], n_passes: int) -> dict[str, int]:
    """
    Rescale the model's relative weighting to hit the budget exactly.

    A 2B model reliably produces a sensible *ratio* but not a set of integers
    summing to an arbitrary target — it will happily answer 8/6/4 when asked
    for 24. Treating the answer as weights keeps the model's actual decision
    (the relative priority between compartments) and fixes only the arithmetic,
    via largest-remainder apportionment.
    """
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("weights sum to zero")

    exact = {k: v / total * n_passes for k, v in weights.items()}
    alloc = {k: int(v) for k, v in exact.items()}

    remaining = n_passes - sum(alloc.values())
    for key, _ in sorted(exact.items(), key=lambda kv: kv[1] - int(kv[1]), reverse=True):
        if remaining <= 0:
            break
        alloc[key] += 1
        remaining -= 1
    return alloc


def propose_allocation(features: dict[str, Any], n_passes: int, model: str = DEFAULT_MODEL) -> dict[str, Any]:
    """
    Ask Gemma how to spend the pass budget across compartments.

    The reply is parsed as a *weighting* rather than a literal pass count: ids
    must be known and non-negative, and the ratio is then rescaled to the exact
    budget. Only a malformed or empty answer falls back to volume share, and
    the response always says which happened.
    """
    ids = [r["id"] for r in features["regions"]]
    # The objective is stated explicitly. Without it the model reliably
    # over-weights the necrotic core and scores well below a plain
    # proportional rule; naming the scoring function is fair, and it is what
    # a human planner would be told too.
    prompt = f"""A tumour segmentation has these compartments, with each one's
share of total tumour volume:

{_compartment_brief(features)}

You have {n_passes} simulated biopsy passes to distribute across them.

The result is scored on REPRESENTATIVENESS: how closely the mix of tissue you
collect matches the tumour's actual volumetric composition. A sample scores
highest when the proportion of passes spent on each compartment mirrors that
compartment's share of the volume. Over-weighting any one compartment lowers
the score, even a clinically interesting one.

Reply with ONLY a JSON object mapping compartment id to a pass count, using the
ids {ids}. Aim for the counts to sum to about {n_passes}.
Example: {{"NCR": 4, "ED": 5, "ET": 3}}"""

    raw = _generate(prompt, model=model, max_tokens=192)
    if raw:
        match = re.search(r"\{[^{}]*\}", raw)
        if match:
            try:
                parsed = json.loads(match.group(0))
                weights = {
                    k: int(v) for k, v in parsed.items() if k in ids and int(v) >= 0
                }
                if weights and sum(weights.values()) > 0:
                    # Fill any compartment the model omitted with zero, so a
                    # deliberate "skip this one" survives the rescale.
                    for rid in ids:
                        weights.setdefault(rid, 0)

                    requested = sum(weights.values())
                    allocation = _repair_to_budget(weights, n_passes)
                    return {
                        "allocation": allocation,
                        "weights": weights,
                        "modelRan": True,
                        "model": model,
                        "source": "gemma",
                        # Surfaced so the UI never implies the model did the
                        # arithmetic when it only supplied the ratio.
                        "rescaled": requested != n_passes,
                        "requestedTotal": requested,
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

    raw = _generate(prompt, model=model, temperature=0.3, max_tokens=320)
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
