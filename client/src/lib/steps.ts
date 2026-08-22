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
    title: "Dataset MRI image",
    narration:
      "This is the MRI scan of subject NSK46 from the OpenNeuro dataset. It contains T1, T1 post-contrast, T2 and FLAIR images, and has already been segmented by an expert — a real scan of a real tumour, not a simulation.",
    stage: "case",
  },
  {
    id: "compartments",
    number: "02",
    title: "Segmentation of the MRI image",
    narration:
      "This is a visualisation of the segmentation, taken directly from the dataset. Three sections have been characterised: a necrotic core, an infiltrative margin, and an active enhancing rim. Because they are roughly equal in volume, a sample needs to represent all three.",
    followUp: "Drag the volume to turn it.",
    stage: "volume",
  },
  {
    id: "baseline",
    number: "03",
    title: "The standard approach, and what it costs",
    narration:
      "The standard approach to biopsying brain tumours directs the needle at the geometric centroid of the mass, through one narrow corridor. By the usual measure it works: essentially every pass returns tumour tissue, giving a near-perfect hit rate.",
    followUp:
      "But the tissue is not representative of the tumour as a whole. One of the three sections is barely touched, sometimes not sampled at all. A pathologist receives tissue that does not describe this tumour — and nothing in the hit rate reveals that.",
    stage: "baseline",
    overlay: "baseline",
  },
  {
    id: "gemma",
    number: "04",
    title: "The model replans, on this computer",
    narration:
      "Now the tumour's structure — just the sizes of the three sections, no image and no patient details — goes to Gemma, an AI model running on this machine. Nothing is sent to the internet. It decides how to spread the same number of passes.",
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
