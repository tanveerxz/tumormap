import type { Provenance } from "@/lib/types";

/**
 * Correct framing for real imaging.
 *
 * This data is NOT synthetic — it is de-identified public research imaging. So
 * the notice has to do two jobs at once: refuse the clinical reading, and be
 * accurate about what the data is and what is known about it. The two caveats
 * below are real limitations of the published files, not hedging.
 */
export default function ProvenanceNotice({ provenance }: { provenance?: Provenance }) {
  return (
    <div className="panel rounded-2xl p-4 ring-1 ring-hairline sm:p-5">
      <div className="flex gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
          style={{ background: "var(--status-warning)", color: "#0d1520" }}
        >
          !
        </span>
        <div className="space-y-2.5">
          <p className="caption text-ink-secondary">
            <strong className="font-semibold text-ink-primary">
              Source of the images
            </strong>{" "}
            The scan used here has been taken from the OpenNeuro dataset of processed
            MRI images of patients with glioblastomas. This dataset has already been
            processed and segmented. Note that this tool is intended only to provide suggestions to clinicians, and not to replace actual medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
