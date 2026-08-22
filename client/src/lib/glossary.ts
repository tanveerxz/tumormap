/**
 * Plain-language explanations for every piece of jargon on the page.
 *
 * Written for someone with no clinical or ML background: no undefined terms,
 * no acronyms left to context, and a concrete "why you should care" rather
 * than a dictionary definition. If a term appears on screen, it belongs here.
 */

export interface GlossaryEntry {
  /** Short plain-English gloss, shown as the tooltip body. */
  plain: string;
  /** Optional second line with the precise/technical meaning. */
  technical?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // --- Imaging ---
  biopsy: {
    plain:
      "Taking a small piece of tissue out of the body with a needle so it can be examined under a microscope.",
  },
  mri: {
    plain:
      "A scan that uses magnets rather than X-rays to photograph the inside of the body. It can be tuned in different ways to make different tissues stand out.",
  },
  "T1 + Gd": {
    plain:
      "A scan taken after injecting a dye. Areas where the tumour has broken through the brain's natural barrier light up bright — usually the most active part.",
    technical: "T1-weighted, gadolinium contrast-enhanced.",
  },
  T1: {
    plain:
      "The plain 'before dye' version of the same scan. Comparing it with the dye version is what reveals the active areas.",
    technical: "T1-weighted, pre-contrast.",
  },
  T2: {
    plain:
      "A different tuning where fluid appears bright. Good for seeing swelling around a tumour.",
    technical: "T2-weighted.",
  },
  FLAIR: {
    plain:
      "Like T2, but the normal fluid in the brain is darkened so that swollen, invaded tissue stands out clearly.",
    technical: "Fluid-attenuated inversion recovery.",
  },
  segmentation: {
    plain:
      "An expert has gone through the scan and outlined exactly which voxels are tumour and which type. It is the ground truth we score against.",
  },
  voxel: {
    plain: "A 3D pixel — one tiny cube of the scan.",
  },
  "native space": {
    plain:
      "The scan as it came off the scanner, in that patient's own head position and dimensions.",
  },
  MNI152: {
    plain:
      "A standard 'average brain' template. Scans are often warped onto it so different patients can be compared in the same coordinate system.",
  },
  "co-registered": {
    plain:
      "Lined up so two images share a coordinate system. Ours are not, which is why the outline is never drawn on top of the scan — it would land in the wrong place.",
  },

  // --- Compartments ---
  NCR: {
    plain:
      "The dead centre of the tumour. Cells here have already died from lack of blood supply, so tissue taken from it says little about what the living tumour is doing.",
    technical: "Necrotic / non-enhancing core.",
  },
  ED: {
    plain:
      "The blurred outer zone where tumour cells are creeping into healthy brain. It matters because it decides how far surgery and radiotherapy need to reach.",
    technical: "Peritumoral infiltration / edema.",
  },
  ET: {
    plain:
      "The live, aggressively growing rim. This is the part whose genetics decide which drugs might work, so it is the part you most want in the sample.",
    technical: "Active enhancing tumour rim.",
  },

  // --- Metrics ---
  "hit rate": {
    plain:
      "How often the needle came back with tumour rather than healthy brain. It sounds like the thing that matters, but it is easy to score 100% and still take a useless sample.",
  },
  representativeness: {
    plain:
      "Does the collected tissue actually look like the tumour as a whole? 100% means the mix of tissue types in the sample matches the mix in the tumour. Low scores mean you sampled one part over and over.",
    technical: "1 − total variation distance between sampled and true mixes.",
  },
  evenness: {
    plain:
      "Whether the sample is spread evenly across the three tumour types, on a 0–1 scale. High evenness means you got a bit of everything.",
    technical: "Pielou's J′ = H′ / ln(3), where H′ is Shannon diversity.",
  },
  "volume share": {
    plain:
      "How much of the whole tumour each type takes up. If one type is a third of the tumour, a fair sample would be about a third from there.",
  },
  passes: {
    plain:
      "How many separate needle insertions the simulation makes. More passes means more tissue but more disruption, so real procedures keep the number low.",
  },
  centroid: {
    plain:
      "The geometric middle of the tumour — the point you would aim at if you treated it as one uniform blob.",
  },

  // --- The AI side ---
  Gemma: {
    plain:
      "A small AI model running on this computer rather than in the cloud. It reads the tumour's structure and decides how to spread the needle passes.",
  },
  "on device": {
    plain:
      "Everything runs on this machine. No scan, no patient detail, and no identifiers are sent over the internet at any point.",
  },
  Ollama: {
    plain: "The tool that runs the AI model locally on this computer.",
  },
  rescaled: {
    plain:
      "The model chose the ratio between the three areas, but its numbers did not add up to the exact number of passes, so we scaled them to fit. The judgement is the model's; the arithmetic is ours.",
  },
};
