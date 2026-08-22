import type { StepId } from "./types";

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
    title: "Dataset MRI image",
    narration:
      "This is the MRI scan of subject in NSK46 the OpenNeuro dataset. It contains T1, T1 post-contrast, T2 and FLAIR images, and as mentioned above, it has already been segmented.",
    stage: "case",
  },
  {
    id: "compartments",
    number: "02",
    title: "Segmentation of the MRI image",
    narration:
      "This is a visualisation of the MRI segmentation, as taken directly from the dataset. There are three sections that have been characterised in the image: a necrotic core, an infiltrative margin, and an active enhancing rim. Because they are all roughly equal in volume, it is important to get representative samples of each type of segment.",
    stage: "volume",
  },
  {
    id: "baseline",
    number: "03",
    title: "The standard approach",
    narration:
      "The standard approach to biopsying brain tumours is where the biopsy needle is directed towards the geometric centroid of the mass, through one narrow corridor.",
    stage: "baseline",
    overlay: "baseline",
  },
  {
    id: "problem",
    number: "04",
    title: "What it missed",
    narration:
      "However, the problem with this approach is that even though it appears as if every pass returns tissue, it's not actually representative of the tumour as a whole. Looking at the aggregate statistics The hit rate looks perfect — essentially every pass returned tumour tissue. But look at the composition: the infiltrative margin is barely represented, or absent entirely. A pathologist receives tissue that does not describe this tumour.",
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
