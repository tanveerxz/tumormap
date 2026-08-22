import type { StepId } from "./types";

/**
 * The guided walkthrough.
 *
 * Ordered so the argument builds rather than dumping every panel at once:
 * establish the real case, show the compartments, run the standard approach,
 * reveal what it missed, let the local model replan, re-run, then compare.
 * Each step is one beat of a demo recording.
 */
export interface Step {
  id: StepId;
  /** Zero-padded index shown in the stepper. */
  number: string;
  title: string;
  /** Spoken-register narration — this is the demo script. */
  narration: string;
  /** What the stage shows at this step. */
  stage: "case" | "volume" | "baseline" | "stratified" | "compare";
  /** Show needle tracks for this strategy, if any. */
  overlay?: "baseline" | "stratified";
}

export const STEPS: Step[] = [
  {
    id: "case",
    number: "01",
    title: "A real case, not a phantom",
    narration:
      "This is subject sub-NSK46 from a public, de-identified research dataset — a 3T Philips study with T1, T1 post-contrast, T2 and FLAIR, plus an expert tumour segmentation. Real imaging, real tumour geometry.",
    stage: "case",
  },
  {
    id: "compartments",
    number: "02",
    title: "One tumour, three territories",
    narration:
      "The segmentation splits the mass into three compartments: a necrotic core, an infiltrative margin, and an active enhancing rim. They are close to equal in volume — so no single one of them stands in for the tumour. Drag to rotate.",
    stage: "volume",
  },
  {
    id: "baseline",
    number: "03",
    title: "The standard approach",
    narration:
      "Standard practice aims the needle at the geometric centroid of the mass, through one narrow corridor. Every pass converges on the middle. Watch where the cores actually land.",
    stage: "baseline",
    overlay: "baseline",
  },
  {
    id: "problem",
    number: "04",
    title: "What it missed",
    narration:
      "The hit rate looks perfect — essentially every pass returned tumour tissue. But look at the composition: the infiltrative margin is barely represented, or absent entirely. A pathologist receives tissue that does not describe this tumour.",
    stage: "baseline",
    overlay: "baseline",
  },
  {
    id: "gemma",
    number: "05",
    title: "Gemma replans, on device",
    narration:
      "The compartment structure — volumes and shares, no image, no identifiers — goes to Gemma running locally through Ollama. Nothing leaves the machine. Gemma returns how it would spend the pass budget across the three territories.",
    stage: "volume",
  },
  {
    id: "stratified",
    number: "06",
    title: "Sampling to the plan",
    narration:
      "The same simulator, the same number of passes, the same tumour — only the targeting changed. Passes are now distributed across compartments, with targets drawn from inside each one.",
    stage: "stratified",
    overlay: "stratified",
  },
  {
    id: "verdict",
    number: "07",
    title: "What actually changed",
    narration:
      "Hit rate barely moves, and can even drop — reaching tumour was never the hard part. Evenness and representativeness move sharply. The finding is not that AI is better; it is that where you sample determines whether the tissue represents the tumour.",
    stage: "compare",
  },
];

export const STEP_INDEX: Record<StepId, number> = STEPS.reduce(
  (acc, step, index) => ({ ...acc, [step.id]: index }),
  {} as Record<StepId, number>,
);
