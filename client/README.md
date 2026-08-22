# Client — biopsy sampling simulator

Next.js + TypeScript frontend for the tumour sampling demo.

**Framing, which is not optional:** everything here runs on synthetic data. The
UI states a property of simulated geometry — "under this tumour geometry, this
sampling strategy produced better coverage" — and never a diagnosis, a
recommendation, or a claim about a patient. Keep new copy in that register.

## Run it

```bash
npm install
npm run dev
```

It works with no backend. With `NEXT_PUBLIC_API_URL` unset the client computes
runs in-browser via `src/lib/pipeline.ts` and labels itself "Local simulation".
Point it at the Python server when that exists:

```bash
cp .env.local.example .env.local   # then edit the URL
```

If the server is configured but unreachable, the client falls back to the local
path and says so in a banner rather than breaking the demo.

## What the server needs to expose

Types are the contract — see [`src/lib/types.ts`](src/lib/types.ts), which is
commented for exactly this purpose. Two endpoints:

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/health` | — | 200 |
| `POST` | `/api/run` | `RunRequest` | `RunResult` |

`RunRequest` is `{ seed, passes, gridSize? }`. `RunResult` carries the slice, the
local model's structured summary, the cloud model's proposed strategy, and one
`StrategyResult` per strategy with its metrics.

Field names are camelCase on the wire. If the Python side prefers snake_case,
alias there (`Field(alias=...)` + `populate_by_name=True`) rather than changing
the TypeScript.

`labels` and `intensity` travel as flat row-major JSON arrays of length
`width * height`. At the default 176×176 that is ~31k numbers each; if payload
size becomes a problem, switch both to base64 and decode client-side — nothing
else in the contract changes.

The whole local pipeline in `src/lib/` is a working reference implementation of
what the server should compute. Porting it to Python is mostly transliteration:

| Client module | What it does |
|---|---|
| `lib/tumour.ts` | Generates the synthetic slice + ground-truth regions |
| `lib/biopsy.ts` | Simulates needle paths, scores hit rate and coverage |
| `lib/pipeline.ts` | Orchestrates it, with the two model stages stubbed |

## The metric

**Representative coverage** = `1 − TVD(sampled region mix, true region mix)`,
where TVD is total variation distance. 1.0 means the collected tissue mirrors
the tumour's composition; concentrating every pass in one region caps it at that
region's share of tumour volume.

This is the number the demo turns on. **Tumour hit rate** — did the needle reach
tumour at all — stays near-identical between strategies, which is the point:
hitting the tumour is easy, sampling it representatively is not.

## Design constraints

Blue / white / orange, clinical instrument register. **IBM Plex Sans** carries
prose and headline figures; **IBM Plex Mono** is reserved for technical
furniture — field labels (`.label-mono`, tracked uppercase), axis ticks, table
numerals, readouts. Keep that split: a mono numeral beside a sans headline is
the whole typographic idea, and a display or serif face belongs nowhere near
the data.

Colour has **two separate roles that must not blur into each other**:

- **Brand chrome** (`--brand`, `--accent`) dresses the interface — buttons,
  focus, the header rule, the top signature bar. It is *never* a data mark.
  Brand blue is a deeper step (`#184f95`) than region blue (`#2a78d6`) so the
  two read as different roles.
- **Region hues** (`--region-a/b/c`) are the page's **only** categorical scale,
  assigned in fixed order and never cycled.

The regions were validated all-pairs against these exact surfaces in both modes
(worst CVD ΔE 9.2 light / 9.4 dark; worst normal-vision ΔE 24.0 / 20.9).

A fourth hue does not clear the all-pairs floors — this was measured, not
guessed — so **sampling strategies are distinguished by small multiples, panel
titles, and opacity, never by colour.** If you add a series, fold it into an
existing slot, facet it, or re-validate the palette; do not invent a hue.

Light-mode aqua sits at 2.74:1 against the surface, under the 3:1 bar. The
relief for that is mandatory and already shipped: every region mark carries a
visible direct label, and `RegionTable` is the full table view. Keep both if you
restyle.

Colours live as CSS custom properties in `src/app/globals.css`, defined for
light on `:root` and redefined for dark under **both** the OS media query and
`[data-theme="dark"]`, so the toggle wins in either direction.
