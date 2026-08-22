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
            processed and segmented. It is used to demonstrate a method — this is a
            research prototype, not a validated medical device.
          </p>
          <p className="caption text-ink-secondary">
            <strong className="font-semibold text-ink-primary">
              The human stays in charge.
            </strong>{" "}
            The system never says “biopsy this patient here.” It says “under this
            tumour geometry, this sampling strategy produced more representative
            tissue.” Where a biopsy is actually taken is a clinician&apos;s judgement.
          </p>

          {provenance && (
            <ul className="caption space-y-1 border-t border-grid pt-2.5 text-ink-muted">
              {!provenance.registered && (
                <li>
                  <span className="text-ink-secondary">Not co-registered:</span> the
                  segmentation is in {provenance.maskSpace} space and the scans are in{" "}
                  {provenance.scanSpace} space, with no published transform between them.
                  They are shown separately here, never overlaid.
                </li>
              )}
              {!provenance.labelSemanticsConfirmed && (
                <li>
                  <span className="text-ink-secondary">Labels assumed:</span> the
                  compartment naming follows the conventional reading of the 1/2/3
                  labels; no dataset description shipped with the files to confirm it.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
