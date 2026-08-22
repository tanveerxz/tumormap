# Demo recording script

Seven beats, one per walkthrough step. The UI is built to be driven with
**arrow keys** — `→` advances, `←` goes back — so you can narrate with both
hands off the mouse except where noted.

Target length: **2:30–3:00**. Times below are cumulative.

## Before you hit record

```bash
# 1. model  (leave running)
ollama serve
ollama pull gemma4:e4b         # once

# 2. api    (leave running)
.venv/Scripts/python -m uvicorn backend.api:app --port 8000

# 3. client (leave running)
cd client && npm run dev
```

Check the nav badge reads **“Gemma local”** in green. If it reads “Gemma
offline” in orange the walkthrough still runs, but step 05 will honestly label
the allocation as a fallback — which is correct behaviour, just a weaker demo.

Set the pass slider to **24** before recording. Full-screen the browser, and
pick light or dark deliberately — both are designed, but switching mid-take
looks accidental.

---

## 00:00 — Step 01 · A real case, not a phantom

> "This is a real, de-identified glioblastoma study from a public research
> dataset. 3-tesla Philips, four sequences — T1, T1 post-contrast, T2, FLAIR —
> with an expert tumour segmentation. Not a phantom, not simulated."

**On screen:** the scans panel and the case metadata. Click through **T1 + Gd →
T2 → FLAIR** so the viewer sees genuine multi-modal imaging.

Point at the caption under the scan: it says the segmentation is not overlaid,
because the mask and the scans are in different coordinate spaces. Say that out
loud — a judge who knows imaging will notice, and naming it first is worth more
than hoping nobody asks.

## 00:25 — Step 02 · One tumour, three territories

> "The segmentation splits the mass into three compartments: necrotic core,
> infiltrative margin, and active enhancing rim. They're close to equal in
> volume — roughly a third each. So no single one of them stands in for the
> tumour."

**On screen:** the 3D volume. **Drag it.** This is the moment the demo earns
its "3D" claim — rotate slowly, then flick it and let the momentum carry. The
legend shows each compartment's true share.

## 00:50 — Step 03 · The standard approach

> "Standard practice aims the needle at the geometric centroid, through one
> narrow corridor. Here are twenty-four passes doing exactly that."

**On screen:** needle tracks converge on the middle of the volume. Rotate once
so the convergence is obvious from a second angle.

## 01:10 — Step 04 · What it missed  ← **the pivot**

> "Hit rate: a hundred percent. Every pass came back with tumour tissue. By the
> usual measure this biopsy was a complete success."
>
> *(beat)*
>
> "But look at the composition. The infiltrative margin is at zero. Not
> under-sampled — absent. The pathologist receives tissue that does not
> describe this tumour."

**On screen:** the stat tiles and the compartment bars. The missing compartment
is flagged **“not sampled”** in orange. Let it sit for a second before moving on.

This is the beat the whole demo exists for. Don't rush it.

## 01:35 — Step 05 · Gemma replans, on device

> "So we hand the structure — just the compartment volumes and shares, no
> image, no identifiers — to Gemma 4 running locally through Ollama. Nothing
> leaves the machine. It comes back with how it would spend the same
> twenty-four passes."

**On screen:** the allocation appears in the sidebar with a green **“from
Gemma”** badge. If it says "fallback", acknowledge it rather than talking over
it: *"the model isn't up here, so that's the deterministic fallback — and the
UI says so."*

## 01:55 — Step 06 · Sampling to the plan

> "Same simulator, same tumour, same twenty-four passes. The only thing that
> changed is where they're aimed."

**On screen:** needle tracks now spread across the volume. Rotate to show the
spread against the previous convergence.

## 02:15 — Step 07 · What actually changed

> "Hit rate barely moves — it even drops slightly. Reaching tumour was never
> the hard part. Representativeness goes from about sixty percent to about
> ninety. Evenness from 0.59 to 0.98."
>
> "The claim isn't that AI is better than a neurosurgeon. It's that *where* you
> sample determines whether the tissue represents the tumour — and that's now
> measurable, on real geometry, with the model running entirely on device."

**On screen:** both strategies side by side, deltas on the stat tiles.

## Close

> "Real imaging. Local inference, zero egress. And a clinician still decides
> where the needle goes — this reports on a simulation, it doesn't direct care."

---

## Things not to claim on camera

These will not survive a knowledgeable question, so keep them out:

- **Don't say "HIPAA compliant."** Local inference is not a compliance
  certification, and the BIDS sidecars still carry institution name, address,
  and scanner serial.
- **Don't say the overlay shows the tumour on the patient's scan.** It doesn't
  — they're unregistered, which is exactly why they're displayed separately.
- **Don't state the compartment labels as confirmed.** The 1/2/3 → NCR/ED/ET
  mapping is the conventional reading; no dataset description shipped to
  confirm it, and BraTS uses label 4 for enhancing tumour. Say "labelled as".
- **Don't quote a fixed improvement figure** as if it generalises. It's one
  subject. Say "on this case".
