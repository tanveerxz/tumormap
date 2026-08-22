"use client";

import { useCallback, useEffect, useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import InfoTip from "@/components/InfoTip";
import MriPanel from "@/components/MriPanel";
import ProvenanceNotice from "@/components/ProvenanceNotice";
import RegionBalance from "@/components/RegionBalance";
import RegionLegend from "@/components/RegionLegend";
import StatTile from "@/components/StatTile";
import ThemeToggle from "@/components/ThemeToggle";
import TumourVolume3D from "@/components/TumourVolume3D";
import { fetchCase, fetchHealth, fetchPointCloud, requestPlan, runSimulation } from "@/lib/api";
import { pct, pp } from "@/lib/format";
import { STEPS } from "@/lib/steps";
import { useTheme } from "@/lib/useTheme";
import type {
  CaseResponse,
  HealthResponse,
  PointCloud,
  RunResponse,
} from "@/lib/types";

export default function Home() {
  const [theme, setTheme] = useTheme();
  const [step, setStep] = useState(0);
  const [passes, setPasses] = useState(24);

  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [cloud, setCloud] = useState<PointCloud | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);

  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Gemma's plan is fetched once, on demand, and then reused across pass
  // counts so the model never sits in the path of a slider drag.
  const [plan, setPlan] = useState<Pick<RunResponse, "strategy" | "narrative"> | null>(null);
  const [planPending, setPlanPending] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const current = STEPS[step];

  // Load the case, geometry, and model status once.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchCase(controller.signal),
      fetchPointCloud(1400, controller.signal),
      fetchHealth(controller.signal).catch(() => null),
    ])
      .then(([c, pc, h]) => {
        setCaseData(c);
        setCloud(pc);
        setHealth(h);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? `${err.message} — is the Python server running on :8000?`
            : "Failed to reach the server",
        );
      });
    return () => controller.abort();
  }, []);

  // Fast, deterministic run. Stale requests are aborted rather than allowed
  // to land out of order, and a failure keeps the last good render on screen.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPending(true);
      runSimulation(passes, plan?.strategy.allocation, controller.signal)
        .then((next) => {
          setRun(next);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Simulation failed");
        })
        .finally(() => setPending(false));
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [passes, plan]);

  const askGemma = useCallback(async () => {
    setPlanPending(true);
    setPlanError(null);
    try {
      setPlan(await requestPlan(passes));
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Gemma request failed");
    } finally {
      setPlanPending(false);
    }
  }, [passes]);

  // Arrow keys drive the walkthrough — one hand on the keyboard while recording.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight")
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const baseline = run?.results.baseline;
  const stratified = run?.results.stratified;
  const overlayPasses =
    current.overlay === "baseline"
      ? baseline?.biopsyPasses
      : current.overlay === "stratified"
        ? plan && !pending
          ? stratified?.biopsyPasses
          : undefined
        : undefined;

  const modelRan = plan?.strategy.modelRan ?? false;

  // Results belong only to steps where a biopsy has actually been simulated.
  // The volume step introduces the anatomy and must not pre-empt the finding
  // by showing baseline numbers before the baseline has been run.
  const showResults =
    current.stage === "baseline" ||
    current.stage === "stratified" ||
    current.stage === "compare";

  return (
    <>
      <nav className="scroll-edge glass sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="label-mono text-ink-primary">TumourMap</span>
          <div className="flex items-center gap-2">
            <span
              className="label-mono flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-ink-secondary ring-1 ring-hairline"
              title={health?.gemma.reason ?? undefined}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: health?.gemma.available
                    ? "var(--delta-good)"
                    : "var(--accent)",
                }}
              />
              {health?.gemma.available ? "Gemma is currently running locally" : "Gemma is currently offline"}
            </span>
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
        {/* Wider than the usual reading measure because the intro is a long
            single paragraph — at max-w-3xl it stacked into a tall block. */}
        <header className="materialize mb-6 max-w-5xl">
          <h1 className="display-1 text-ink-primary">Comparing standard and AI-driven approaches to brain tumour biopsy</h1>
          <p className="body-text mt-4 text-ink-secondary">
            Our project compares the traditional approach to the sampling of glioblastomas, which is directly inserting the biopsy needle into
            the centre of mass of the tumour, to an approach where the sample locations are suggested by a local image processing pipeline using Gemma.
            Often, the problem with the standard sampling approach is that not all types of tissue in the tumour are represented in the sampled tissue; 
            if you just aim towards the middle of the mass, you risk under or oversampling different tissue types. As such, we have built a tool to 
            visualise the tumour and the sampling locations, and to compare the two approaches. The tool is intended for educational purposes only, and is not to be used for clinical decisions.
          </p>
        </header>

        {error && (
          <div className="panel caption mb-6 rounded-2xl p-4 ring-1 ring-hairline">
            <strong className="font-semibold text-ink-primary">Server unreachable</strong>{" "}
            <span className="text-ink-secondary">{error}</span>
            <p className="mono mt-2 text-xs text-ink-muted">
              uvicorn backend.api:app --port 8000
            </p>
          </div>
        )}

        <div className="mb-6">
          <ProvenanceNotice provenance={caseData?.provenance} />
        </div>

        {/* ---- Walkthrough control: the spine of the demo recording ---- */}
        <div className="glass-strong sticky top-14 z-20 mb-6 rounded-2xl p-4 ring-1 ring-hairline">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={step === 0}
                className="press rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-secondary ring-1 ring-hairline hover:text-ink-primary disabled:opacity-40"
                aria-label="Previous step"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
                disabled={step === STEPS.length - 1}
                className="press rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-40"
              >
                Next →
              </button>
            </div>

            {/* Step pips: position in the story, always visible on camera. */}
            <ol className="flex flex-1 items-center gap-1.5" aria-label="Walkthrough steps">
              {STEPS.map((s, i) => (
                <li key={s.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    title={s.title}
                    aria-current={i === step ? "step" : undefined}
                    className="block h-1.5 w-full rounded-full transition-colors"
                    style={{
                      background:
                        i === step
                          ? "var(--brand)"
                          : i < step
                            ? "var(--ink-muted)"
                            : "var(--surface-2)",
                    }}
                  >
                    <span className="sr-only">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-3">
              <label
                htmlFor="passes"
                className="label-mono flex items-center gap-1.5 text-ink-muted"
              >
                Passes
                <InfoTip term="passes" badge />
              </label>
              <input
                id="passes"
                type="range"
                min={6}
                max={96}
                step={6}
                value={passes}
                onChange={(e) => setPasses(Number(e.target.value))}
                className="h-1 w-28 accent-brand"
              />
              <span className="mono tabular w-7 text-right text-sm text-ink-primary">
                {passes}
              </span>
            </div>
          </div>
        </div>

        {/* ---- Narration + stage ---- */}
        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
          <aside className="lg:sticky lg:top-36 lg:self-start">
            <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
              <div className="label-mono mb-3 text-brand">
                Step {current.number} / {STEPS.length.toString().padStart(2, "0")}
              </div>
              <h2 className="title-1 mb-3 text-ink-primary">{current.title}</h2>
              <p className="body-text text-ink-secondary">{current.narration}</p>

              {current.id === "gemma" && (
                <div className="mt-4 border-t border-grid pt-4">
                  {!plan && (
                    <>
                      <button
                        type="button"
                        onClick={() => void askGemma()}
                        disabled={planPending}
                        className="press w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-60"
                      >
                        {planPending ? "Gemma is planning…" : "Ask Gemma to replan"}
                      </button>
                      <p className="caption mt-2.5 text-ink-muted">
                        {planPending
                          ? "Running locally through Ollama. Nothing leaves this machine."
                          : "Runs gemma2:2b on device. Takes a few seconds."}
                      </p>
                    </>
                  )}

                  {planError && (
                    <p className="caption mt-2.5" style={{ color: "var(--accent)" }}>
                      {planError}
                    </p>
                  )}

                  {plan && (
                    <>
                      <div className="label-mono mb-2 flex flex-wrap items-center gap-2 text-ink-muted">
                        Allocation
                        <span
                          className="rounded-full bg-surface-2 px-2 py-0.5"
                          style={{
                            color: modelRan ? "var(--delta-good)" : "var(--accent)",
                          }}
                        >
                          {modelRan ? "from Gemma" : "fallback"}
                        </span>
                      </div>
                      <ul className="mono space-y-1 text-xs text-ink-secondary">
                        {Object.entries(plan.strategy.allocation).map(([id, count]) => (
                          <li key={id} className="flex justify-between tabular">
                            <span>{id}</span>
                            <span className="text-ink-primary">{count} passes</span>
                          </li>
                        ))}
                      </ul>
                      {plan.strategy.rescaled && (
                        <p className="caption mt-2.5 text-ink-muted">
                          Gemma returned the weighting{" "}
                          {Object.values(plan.strategy.weights ?? {}).join(" / ")} (
                          {plan.strategy.requestedTotal} passes); rescaled to {passes}.
                          The ratio is the model&apos;s, the arithmetic is not.
                        </p>
                      )}
                      {!modelRan && (
                        <p className="caption mt-2.5 text-ink-muted">
                          Gemma did not run, so this is volume-share apportionment, not a
                          model decision. {plan.strategy.reason}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void askGemma()}
                        disabled={planPending}
                        className="press mt-3 text-xs text-ink-muted underline underline-offset-2 hover:text-ink-primary"
                      >
                        {planPending ? "asking…" : "ask again"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {current.id === "verdict" && plan?.narrative && (
                <div className="mt-4 border-t border-grid pt-4">
                  <div className="label-mono mb-2 text-ink-muted">
                    {plan.narrative.modelRan ? "Gemma’s reading" : "Deterministic summary"}
                  </div>
                  <p className="caption whitespace-pre-line text-ink-secondary">
                    {plan.narrative.text}
                  </p>
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            {/* Stage: real scans, or the 3D volume with needle tracks. */}
            {current.stage === "case" ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
                  <h3 className="title-2 mb-3 text-ink-primary">The scans</h3>
                  <MriPanel />
                </div>
                <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
                  <h3 className="title-2 mb-3 text-ink-primary">The case</h3>
                  {caseData && (
                    <dl className="caption space-y-2.5">
                      {[
                        ["Subject", caseData.features.subjectId],
                        ["Tumour volume", `${caseData.features.tumourVolumeCm3} cm³`],
                        [
                          "Segmentation",
                          `${caseData.features.space} · ${caseData.features.voxelSizeMm.join(" × ")} mm`,
                        ],
                        [
                          "Scanner",
                          `${caseData.acquisition.manufacturer ?? "—"} ${caseData.acquisition.model ?? ""} · ${caseData.acquisition.fieldStrengthT ?? "?"}T`,
                        ],
                        ["Modalities", caseData.modalities.join(", ")],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <dt className="text-ink-muted">{k}</dt>
                          <dd className="mono text-right text-ink-primary">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            ) : (
              <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="title-2 text-ink-primary">
                    Tumour volume
                    <span className="label-mono ml-2 text-ink-muted">
                      {caseData?.features.space} · drag to rotate
                    </span>
                  </h3>
                  <RegionLegend features={caseData?.features} showShare />
                </div>
                <div className="h-104 sm:h-128">
                  {cloud ? (
                    <TumourVolume3D
                      cloud={cloud}
                      passes={overlayPasses}
                      shape={caseData?.features.shape}
                      themeKey={theme}
                      autoRotate={!overlayPasses}
                    />
                  ) : (
                    <div className="caption grid h-full place-items-center text-ink-muted">
                      Loading volume…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metrics appear once there is something to compare. */}
            {run && baseline && stratified && showResults && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                    {(current.stage === "compare"
                      ? ([
                          ["Representativeness", "representativeness", stratified.representativeness, run.delta.representativeness],
                          ["Evenness", "evenness", stratified.evenness, run.delta.evenness],
                          ["Hit rate", "hit rate", stratified.hitRate, run.delta.hitRate],
                        ] as const)
                      : ([
                          [
                            "Representativeness",
                            "representativeness",
                            current.stage === "baseline"
                              ? baseline.representativeness
                              : stratified.representativeness,
                            undefined,
                          ],
                          [
                            "Evenness",
                            "evenness",
                            current.stage === "baseline" ? baseline.evenness : stratified.evenness,
                            undefined,
                          ],
                          [
                            "Hit rate",
                            "hit rate",
                            current.stage === "baseline" ? baseline.hitRate : stratified.hitRate,
                            undefined,
                          ],
                        ] as const)
                    ).map(([label, term, value, delta]) => (
                      <StatTile
                        key={label}
                        label={label}
                        term={term}
                        value={value as number}
                        format={(v) => (label === "Evenness" ? v.toFixed(2) : pct(v))}
                        delta={delta as number | undefined}
                        deltaLabel={delta !== undefined ? pp(delta as number) : undefined}
                        pending={pending}
                      />
                  ))}
                </div>

                <div
                  className={
                    current.stage === "compare"
                      ? "grid gap-4 md:grid-cols-2"
                      : "grid gap-4"
                  }
                >
                  {(current.stage === "compare"
                    ? [baseline, stratified]
                    : [current.stage === "stratified" ? stratified : baseline]
                  ).map((result) => (
                    <div
                      key={result.name}
                      className="panel rounded-2xl p-5 ring-1 ring-hairline"
                    >
                      <div className="mb-4 flex items-baseline justify-between gap-3">
                        <div>
                          <h3 className="title-2 text-ink-primary">{result.name}</h3>
                          <p className="caption mt-0.5 text-ink-secondary">
                            {result.approach}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <AnimatedNumber
                            value={result.representativeness}
                            format={(v) => pct(v)}
                            className="mono block text-xl leading-none text-ink-primary"
                          />
                          <div className="label-mono mt-1 text-ink-muted">repr.</div>
                        </div>
                      </div>
                      {caseData && (
                        <RegionBalance
                          features={caseData.features}
                          result={result}
                          pending={pending}
                        />
                      )}
                      <p className="mono mt-3 text-xs text-ink-muted">
                        {result.hits}/{result.passes} passes hit tumour ·{" "}
                        {result.regionsTouched}/3 compartments reached
                      </p>
                    </div>
                  ))}
                </div>

                {current.stage === "compare" && (
                  <div className="panel rounded-2xl p-5 ring-1 ring-hairline">
                    <RegionLegend features={caseData?.features} showReference />
                    <p className="caption mt-3 text-ink-secondary">
                      <strong className="font-semibold text-ink-primary">
                        How to read this:
                      </strong>{" "}
                      the bars show where the collected tissue came from; the thin
                      vertical line marks how big that part of the tumour actually is. A
                      bar that stops short of its line means that part was
                      under-sampled. <InfoTip term="evenness">Evenness</InfoTip> asks
                      whether the sample is spread out;{" "}
                      <InfoTip term="representativeness">representativeness</InfoTip>{" "}
                      asks whether it matches <em>this</em> tumour. They can disagree, so
                      both are shown.
                    </p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        <footer className="caption mt-10 border-t border-grid pt-5 text-ink-muted">
          <p>
            Real de-identified research imaging. Research prototype — not a medical
            device, not a diagnosis, not a recommendation for any patient.
          </p>
        </footer>
      </div>
    </>
  );
}
