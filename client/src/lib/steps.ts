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
      "This is the MRI scan of subject in NSK46 the OpenNeuro dataset. It contains T1, T1 post-contrast, T2 and FLAIR images, and as mentioned above, it has already been segmented. Some additional metadata about the patient has also been shown to the right, as this is part of what is given to Gemma in the AI-assisted processing stage.",
    stage: "case",
    },
  {
    id: "compartments",
    number: "02",
    title: "Segmentation of the MRI image",
    narration:
      "This is a visualisation of the MRI segmentation, as taken directly from the dataset. There are three sections that have been characterised in the image: necrotic tissue (shown in blue), infiltrative tissue (shown in orange), and enhancing tissue (green). Because they are not all equal in volume, it is important to get representative samples of each type of segment that actually mirrors the structure of the tumour.",
    stage: "volume",
  },
  {
    id: "baseline",
    number: "03",
    title: "The standard approach",
    narration:
      "The standard approach to biopsying brain tumours is where the biopsy needle is directed towards the geometric centroid of the mass, through one narrow corridor. However, the problem with this approach is that even though it appears as if every pass returns tissue, it's not actually representative of the tumour as a whole. Looking at the aggregate statistics below, you can see that the proportions of sampled tissue using the standard approach doesn't match the true proportions of the tumour (the vertical black lines). For instance, infiltrative tissue has not been sampled at all, while enchancing tissue has been drastically oversampled.",
    stage: "baseline",
    overlay: "baseline",
  },
  {
    id: "gemma",
    number: "04",
    title: "The AI-assisted approach",
    narration:
      "The segmented MRI scan, along with the patient metadata (as seen in Step 1) has been sent to Gemma running locally through Ollama. The reason for the model running locally is to preserve patient privacy and reduce unecessarily exposing data to external servers, which poses a security risk. Gemma  takes this information and returns how it allocate the given number of total samples differently, optimising to more accurately represent the sample tissue proportions. Click the button below to start the pipeline.",
      stage: "volume",
  },
  {
    id: "verdict",
    number: "05",
    title: "Comparison of approaches",
    narration:
    "The suggested sampling method by Gemma has been compared below to the standard approach. As you can see in the two comparisons below, the AI-assisted sampling more closely represents the true proportions of the three tissue types in this specific tumour. Measures of 'representativeness' are calculated, where the AI-assisted approach has a lower KL divergence and a higher Jensen-Shannon similarity score. These are both measures of how closely the sampled tissue matches the true proportions of the tumour tissue. The AI-assisted approach is generally better, however notice that it has generated sampling directions that result in a 8 percentage point reduction in hit rate, meaning that fewer of the passes actually hit the tumour. This can potentially be more dangerous for the patient, which is why this tool must only be used in combination with a clinician's assessment.",
    stage: "compare",
  },
];

export const STEP_INDEX: Record<StepId, number> = STEPS.reduce(
  (acc, step, index) => ({ ...acc, [step.id]: index }),
  {} as Record<StepId, number>,
);
