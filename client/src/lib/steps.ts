import type { StepId } from "./types";

/**
 * The guided walkthrough.
 *
 * Five beats. The standard approach and its failure are one step, not two —
 * the whole point is that the good number and the bad number describe the same
 * biopsy, so splitting them across a click lets the contradiction go unnoticed.
 * Likewise the model's plan and the re-run are one step: the plan is only
 * meaningful once you see what it does.
 */
export interface Step {
  id: StepId;
  /** Zero-padded index shown in the stepper. */
  number: string;
  title: string;
  /** Spoken-register narration — this doubles as the demo script. */
  narration: string;
  /** Optional second paragraph, used where a step carries a turn. */
  followUp?: string;
  /** What the stage shows at this step. */
  stage: "case" | "volume" | "baseline" | "stratified" | "compare";
  /** Show needle tracks for this strategy, if any. */
  overlay?: "baseline" | "stratified";
}

export const STEPS: Step[] = [
  {
    id: "case",
    number: "01",
    title: "A real case",
    narration:
      "This is a real, de-identified brain scan from a public research dataset — not a simulation and not a phantom. Four different scan types of the same head, plus an expert outline of exactly where the tumour is and which parts are which.",
    stage: "case",
  },
  {
    id: "compartments",
    number: "02",
    title: "One tumour, three territories",
    narration:
      "A tumour is not one uniform thing. This one has a dead core, a live growing rim, and a blurred zone where it is invading healthy brain. They are close to equal in size, so no single one of them speaks for the whole tumour.",
    followUp: "Drag the volume to turn it.",
    stage: "volume",
  },
  {
    id: "baseline",
    number: "03",
    title: "The standard approach, and what it costs",
    narration:
      "Standard practice aims the needle at the middle of the mass. Every pass converges on the same point — and by the usual measure it works: essentially every needle comes back with tumour tissue. A perfect hit rate.",
    followUp:
      "But look at where that tissue came from. One of the three territories is barely touched, sometimes not sampled at all. The lab receives a sample that does not describe this tumour — and nothing about the hit rate reveals that.",
    stage: "baseline",
    overlay: "baseline",
  },
  {
    id: "gemma",
    number: "04",
    title: "The model replans, on this computer",
    narration:
      "Now the tumour's structure — just the sizes of the three parts, no image and no patient details — goes to Gemma, an AI model running on this machine. Nothing is sent to the internet. It decides how to spread the same number of passes.",
    followUp:
      "The simulation re-runs on its plan. Same tumour, same number of passes, same needle — the only thing that changed is where they are aimed.",
    stage: "stratified",
    overlay: "stratified",
  },
  {
    id: "verdict",
    number: "05",
    title: "What actually changed",
    narration:
      "The hit rate barely moves, and can even fall — reaching the tumour was never the hard part. What moves is how well the sample matches the tumour it came from.",
    followUp:
      "The claim is not that AI beats a surgeon. It is that where you sample decides whether the tissue represents the tumour, and that this is now measurable on real anatomy.",
    stage: "compare",
  },
];

export const STEP_INDEX: Record<StepId, number> = STEPS.reduce(
  (acc, step, index) => ({ ...acc, [step.id]: index }),
  {} as Record<StepId, number>,
);
