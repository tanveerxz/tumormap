"use client";

import Link from "next/link";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import RegionLegend from "@/components/RegionLegend";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/lib/useTheme";

const FACTS = [
  { value: "3", label: "tissue compartments", note: "necrotic, infiltrative, enhancing" },
  { value: "310 cm³", label: "tumour volume", note: "real segmented glioblastoma" },
  { value: "0", label: "bytes sent off-device", note: "Gemma runs through Ollama locally" },
];

const STACK = [
  "Next.js",
  "TypeScript",
  "FastAPI",
  "NumPy",
  "nibabel",
  "Gemma 4 · E4B",
  "Ollama",
];

/**
 * Project cover.
 *
 * A standalone page for a submission listing or a shared link: what the project
 * is, one honest headline result, and a still of the real data — without the
 * walkthrough's controls. The caveats stay on this page too, because a cover is
 * exactly where a reader decides what to believe about the whole thing.
 */
export default function Cover() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <div className="mb-10 flex items-start justify-between gap-4">
        <span className="label-mono text-brand">TumourMap</span>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="materialize">
          <h1 className="display-1 text-ink-primary">
            Where a biopsy lands decides what the lab sees
          </h1>

          <p className="body-text mt-5 max-w-xl text-ink-secondary">
            A brain tumour is not one uniform thing, but a needle samples well under one
            percent of it. We simulate stereotactic biopsy passes over a real, segmented
            glioblastoma and measure how well the collected tissue represents the whole
            mass — comparing standard centre-of-mass targeting against a plan produced by
            Gemma running entirely on the local machine.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/"
              className="press rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-hover"
            >
              Open the walkthrough
            </Link>
            <a
              href="https://openneuro.org"
              target="_blank"
              rel="noopener noreferrer"
              className="press rounded-xl bg-surface-2 px-5 py-2.5 text-sm text-ink-secondary ring-1 ring-hairline hover:text-ink-primary"
            >
              Dataset source
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-1.5">
            {STACK.map((item) => (
              <li
                key={item}
                className="label-mono rounded-full bg-surface-2 px-2.5 py-1 text-ink-secondary ring-1 ring-hairline"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* The thumbnail: a still of the actual segmentation, not an illustration. */}
        <figure className="materialize panel relative aspect-square overflow-hidden rounded-3xl ring-1 ring-hairline">
          <ProjectThumbnail className="absolute inset-0" />
          <figcaption className="absolute inset-x-0 bottom-0 p-4">
            <div className="glass rounded-xl p-3">
              <RegionLegend />
            </div>
          </figcaption>
        </figure>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {FACTS.map((fact) => (
          <div key={fact.label} className="panel rounded-2xl p-5 ring-1 ring-hairline">
            <div className="figure-md text-ink-primary">{fact.value}</div>
            <div className="label-mono mt-2 text-ink-muted">{fact.label}</div>
            <p className="caption mt-1.5 text-ink-secondary">{fact.note}</p>
          </div>
        ))}
      </div>

      {/* The same caveats the tool carries. A cover page is not an exemption. */}
      <div className="panel mt-6 rounded-2xl p-5 ring-1 ring-hairline">
        <p className="caption text-ink-secondary">
          <strong className="font-semibold text-ink-primary">
            Educational research prototype.
          </strong>{" "}
          Built on real de-identified imaging from a public research dataset. It reports
          on a simulation over one subject&apos;s tumour geometry — it is not a medical
          device, not a diagnosis, and not a recommendation for any patient. Where a
          biopsy is actually taken is a clinician&apos;s judgement.
        </p>
      </div>
    </div>
  );
}
