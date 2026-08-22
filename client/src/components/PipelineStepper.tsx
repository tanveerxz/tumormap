import type { PipelineStage } from "@/lib/types";

const ORDER: PipelineStage[] = [
  "idle",
  "synthesising",
  "gemma",
  "gemini",
  "simulating",
  "comparing",
  "done",
];

interface Step {
  stage: PipelineStage;
  title: string;
  detail: string;
  chip?: { text: string; tone: "local" | "cloud" };
}

const STEPS: Step[] = [
  {
    stage: "synthesising",
    title: "Synthetic slice",
    detail: "Generated with known ground truth",
  },
  {
    stage: "gemma",
    title: "Local analysis",
    detail: "Slice → structured region summary",
    chip: { text: "Gemma · on device", tone: "local" },
  },
  {
    stage: "gemini",
    title: "Sampling strategy",
    detail: "Reasons over the summary, not the image",
    chip: { text: "Gemini · cloud", tone: "cloud" },
  },
  {
    stage: "simulating",
    title: "Biopsy simulation",
    detail: "Both strategies, same slice and seed",
  },
  {
    stage: "comparing",
    title: "Comparison",
    detail: "Hit rate and representative coverage",
  },
];

export default function PipelineStepper({ stage }: { stage: PipelineStage }) {
  const current = ORDER.indexOf(stage);

  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {STEPS.map((step) => {
        const index = ORDER.indexOf(step.stage);
        const state = current > index ? "done" : current === index ? "active" : "pending";

        return (
          <li
            key={step.stage}
            className="rounded-lg bg-surface-1 p-3 ring-1 ring-hairline transition-opacity"
            style={{ opacity: state === "pending" ? 0.5 : 1 }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full text-[10px] font-medium"
                style={{
                  background: state === "pending" ? "var(--surface-2)" : "var(--brand)",
                  color: state === "pending" ? "var(--ink-muted)" : "var(--brand-ink)",
                }}
              >
                {state === "done" ? "✓" : index}
              </span>
              <span className="text-sm font-medium text-ink-primary">{step.title}</span>
            </div>

            <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{step.detail}</p>

            {step.chip && (
              <span
                className="label-mono mt-2.5 inline-block rounded-full px-2 py-1 ring-1 ring-hairline"
                style={{
                  background: "var(--surface-2)",
                  // The cloud hop is the one the audience should notice.
                  color:
                    step.chip.tone === "cloud" ? "var(--accent)" : "var(--ink-secondary)",
                }}
              >
                {step.chip.text}
              </span>
            )}

            <span className="sr-only">
              {state === "done" ? "complete" : state === "active" ? "in progress" : "not started"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
