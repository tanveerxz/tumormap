"use client";

import { useCallback, useEffect, useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import PipelineStepper from "@/components/PipelineStepper";
import Premise from "@/components/Premise";
import PrivacyBoundary from "@/components/PrivacyBoundary";
import RegionBalance from "@/components/RegionBalance";
import RegionLegend from "@/components/RegionLegend";
import RegionTable from "@/components/RegionTable";
import ResearchNotice from "@/components/ResearchNotice";
import StatTile from "@/components/StatTile";
import ThemeToggle from "@/components/ThemeToggle";
import TumourSlice from "@/components/TumourSlice";
import { hasConfiguredServer, runPipeline } from "@/lib/api";
import { pct, pp } from "@/lib/format";
import type { PipelineStage, RunResult, StrategyId } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";

const STAGE_WALK: PipelineStage[] = [
  "synthesising",
  "gemma",
  "gemini",
  "simulating",
  "comparing",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PANELS: Array<{ id: StrategyId; caption: string }> = [
  { id: "traditional", caption: "Baseline — aim at the mass you can see" },
  { id: "ai-guided", caption: "Proposed — spread across the territories" },
];

export default function Home() {
  const [theme, setTheme] = useTheme();
  const [seed, setSeed] = useState(20260822);
  const [passes, setPasses] = useState(120);
  const [run, setRun] = useState<RunResult | null>(null);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [pending, setPending] = useState(true);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const execute = useCallback(async (nextSeed: number, nextPasses: number) => {
    setPending(true);
    for (const step of STAGE_WALK) {
      setStage(step);
      await sleep(110);
    }
    const { result, fellBack, reason } = await runPipeline({
      seed: nextSeed,
      passes: nextPasses,
    });
    setRun(result);
    setFallbackReason(fellBack ? (reason ?? "server unreachable") : null);
    setStage("done");
    setPending(false);
  }, []);

  // Debounced so dragging the pass slider does not queue a run per frame.
  useEffect(() => {
    const timer = setTimeout(() => void execute(seed, passes), 200);
    return () => clearTimeout(timer);
  }, [seed, passes, execute]);

  const traditional = run?.results.traditional;
  const guided = run?.results["ai-guided"];

  return (
    <>
      {/* Floating chrome: content scrolls underneath, and the edge fades rather
          than meeting a hard 1px divider. */}
      <nav className="scroll-edge glass sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="label-mono text-ink-primary">Sampling&nbsp;Simulator</span>
          <div className="flex items-center gap-2">
            <span
              className="label-mono flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-ink-secondary ring-1 ring-hairline"
              title={
                hasConfiguredServer
                  ? "NEXT_PUBLIC_API_URL is set"
                  : "Set NEXT_PUBLIC_API_URL to use the Python server"
              }
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: run?.source === "server" ? "var(--brand)" : "var(--accent)",
                }}
              />
              {run?.source === "server" ? "Python server" : "Local sim"}
            </span>
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <header className="materialize mb-8 max-w-3xl">
          <p className="label-mono mb-3 text-brand">
            Intratumour heterogeneity · sampling simulation
          </p>
          <h1 className="display-1 text-ink-primary">Where should a biopsy be taken?</h1>
          <p className="body-text mt-4 text-ink-secondary">
            A tumour is not uniform, and a needle samples a tiny fraction of it. This
            simulation asks whether the <em>placement</em> of those passes changes how
            well the collected tissue represents the whole mass — and whether a model
            reasoning over the tumour&apos;s structure can place them better than
            aiming at the obvious target.
          </p>
        </header>

        <div className="mb-10 space-y-3">
          <ResearchNotice />
          {fallbackReason && (
            <div className="panel caption rounded-2xl p-4 text-ink-secondary ring-1 ring-hairline">
              <strong className="font-semibold text-ink-primary">Server unavailable</strong>{" "}
              — fell back to the in-browser simulation ({fallbackReason}).
            </div>
          )}
        </div>

        <Premise />

        {/* One control row, above everything it scopes, and it stays reachable. */}
        <div className="glass-strong sticky top-14 z-20 mb-8 flex flex-wrap items-end gap-x-8 gap-y-4 rounded-2xl p-4 ring-1 ring-hairline">
          <div className="min-w-56 flex-1">
            <label htmlFor="passes" className="label-mono mb-2.5 block text-ink-muted">
              Biopsy passes per strategy
            </label>
            <div className="flex items-center gap-3">
              <input
                id="passes"
                type="range"
                min={20}
                max={300}
                step={10}
                value={passes}
                onChange={(event) => setPasses(Number(event.target.value))}
                className="h-1 flex-1 accent-brand"
              />
              <span className="mono tabular w-9 text-right text-sm text-ink-primary">
                {passes}
              </span>
            </div>
          </div>

          <div>
            <span className="label-mono mb-2.5 block text-ink-muted">Slice seed</span>
            <span className="mono tabular text-sm text-ink-primary">{seed}</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
              className="press rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-hover"
            >
              New slice
            </button>
            <button
              type="button"
              onClick={() => void execute(seed, passes)}
              className="press rounded-xl bg-surface-2 px-4 py-2 text-sm text-ink-secondary ring-1 ring-hairline hover:text-ink-primary"
            >
              Re-run
            </button>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="label-mono mb-4 text-ink-muted">Pipeline</h2>
          <PipelineStepper stage={stage} />
        </section>

        {!run ? (
          <div className="panel grid h-64 place-items-center rounded-2xl text-sm text-ink-secondary ring-1 ring-hairline">
            Running simulation…
          </div>
        ) : (
          <>
            {/* The headline is one number — a hero figure, not a two-bar chart. */}
            <section className="mb-10 grid gap-4 lg:grid-cols-3" aria-live="polite">
              <div className="panel relative overflow-hidden rounded-2xl p-6 ring-1 ring-hairline">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ background: "var(--brand)" }}
                />
                <div className="label-mono text-ink-muted">Representative coverage</div>
                <AnimatedNumber
                  value={run.delta.representativeCoverage}
                  format={pp}
                  className="figure-hero mt-3 block text-ink-primary"
                />
                {/* Status colour with an icon and a word — never colour alone. */}
                <div
                  className="mt-3 flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--delta-good)" }}
                >
                  <span aria-hidden>▲</span>
                  <span className="font-medium">improvement</span>
                </div>
                <p className="caption mt-3 text-ink-secondary">
                  Change from the traditional strategy to the AI-guided one, on this
                  simulated slice.
                </p>
              </div>

              <StatTile
                label="Representative coverage"
                value={guided!.metrics.representativeCoverage}
                format={(v) => pct(v)}
                delta={run.delta.representativeCoverage}
                deltaLabel={pp(run.delta.representativeCoverage)}
                hint={`Traditional reached ${pct(
                  traditional!.metrics.representativeCoverage,
                )}. 100% means the collected tissue mirrors the tumour's composition.`}
                pending={pending}
              />

              <StatTile
                label="Tumour hit rate"
                value={guided!.metrics.hitRate}
                format={(v) => pct(v)}
                delta={run.delta.hitRate}
                deltaLabel={pp(run.delta.hitRate)}
                hint={`Traditional reached ${pct(
                  traditional!.metrics.hitRate,
                )}. Hitting tumour is the easy part — it barely separates the two.`}
                pending={pending}
              />
            </section>

            {/* Small multiples: identical scales, identity from the panel title. */}
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="title-1 text-ink-primary">Where the passes landed</h2>
                <RegionLegend />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {PANELS.map(({ id, caption }) => {
                  const result = run.results[id];
                  return (
                    <div key={id} className="panel rounded-2xl p-5 ring-1 ring-hairline">
                      <div className="mb-4 flex items-baseline justify-between gap-3">
                        <div>
                          <h3 className="title-2 text-ink-primary">{result.label}</h3>
                          <p className="caption mt-0.5 text-ink-secondary">{caption}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <AnimatedNumber
                            value={result.metrics.representativeCoverage}
                            format={(v) => pct(v)}
                            className="mono block text-xl leading-none text-ink-primary"
                          />
                          <div className="label-mono mt-1 text-ink-muted">coverage</div>
                        </div>
                      </div>

                      <TumourSlice
                        map={run.map}
                        paths={result.paths}
                        themeKey={theme}
                        pending={pending}
                      />

                      <p className="caption mt-4 text-ink-secondary">{result.approach}</p>
                      <p className="mono mt-1.5 text-xs text-ink-muted">
                        {result.metrics.hits}/{result.metrics.passes} passes hit tumour ·{" "}
                        {result.metrics.regionsTouched}/3 regions reached
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="title-1 text-ink-primary">
                  Sampled share vs. true volume share
                </h2>
                <RegionLegend showReference />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {PANELS.map(({ id }) => (
                  <div key={id} className="panel rounded-2xl p-5 ring-1 ring-hairline">
                    <h3 className="title-2 mb-4 text-ink-primary">
                      {run.results[id].label}
                    </h3>
                    <RegionBalance map={run.map} result={run.results[id]} pending={pending} />
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="title-1 mb-4 text-ink-primary">Where the data goes</h2>
              <PrivacyBoundary />
            </section>

            <section className="mb-10 grid gap-4 md:grid-cols-2">
              <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="title-2 text-ink-primary">Local analysis</h2>
                  <span className="label-mono rounded-full bg-surface-2 px-2.5 py-1 text-ink-secondary ring-1 ring-hairline">
                    {run.analysis.model}
                  </span>
                </div>
                <p className="caption text-ink-secondary">{run.analysis.summary}</p>
                <dl className="mt-4 space-y-2.5">
                  {run.analysis.regions.map((region) => (
                    <div key={region.id} className="caption">
                      <dt className="font-medium text-ink-primary">
                        {region.label} — {region.density}
                      </dt>
                      <dd className="text-ink-secondary">{region.note}</dd>
                    </div>
                  ))}
                </dl>
                <p className="caption mt-4 border-t border-grid pt-3 text-ink-muted">
                  The slice itself never leaves the machine. Only the structured summary
                  above is passed onward.
                </p>
              </div>

              <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="title-2 text-ink-primary">Sampling strategy</h2>
                  <span className="label-mono rounded-full bg-surface-2 px-2.5 py-1 text-ink-secondary ring-1 ring-hairline">
                    {run.strategy.model}
                  </span>
                </div>
                <p className="caption text-ink-secondary">{run.strategy.rationale}</p>
                <ul className="mono mt-4 space-y-1.5 text-xs text-ink-secondary">
                  {run.strategy.allocation.map((entry) => (
                    <li key={entry.region} className="flex justify-between tabular">
                      <span>Region {entry.region}</span>
                      <span className="text-ink-primary">{entry.passes} passes</span>
                    </li>
                  ))}
                </ul>
                <p className="caption mt-4 border-t border-grid pt-3 text-ink-muted">
                  Receives the structured summary only — never the image.
                </p>
              </div>
            </section>

            <section className="panel mb-10 rounded-2xl p-5 ring-1 ring-hairline">
              <h2 className="title-2 mb-4 text-ink-primary">All values</h2>
              <RegionTable run={run} />
            </section>
          </>
        )}

        <footer className="caption border-t border-grid pt-5 text-ink-muted">
          <p>
            Representative coverage is 1 − the total variation distance between the
            sampled region distribution and the true one. Concentrating every pass in a
            single region caps it at that region&apos;s share of tumour volume.
          </p>
          <p className="mt-2">
            Synthetic data throughout. Not a medical device, not a diagnosis, not a
            recommendation for any patient.
          </p>
        </footer>
      </div>
    </>
  );
}
