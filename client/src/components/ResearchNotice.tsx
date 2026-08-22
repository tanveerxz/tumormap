/**
 * Non-negotiable framing. This tool demonstrates a property of sampling
 * geometry on synthetic data; it does not evaluate patients and must never be
 * presented as if it does. The second half is the human-in-charge boundary:
 * the system reports on a simulation, it does not direct care.
 */
export default function ResearchNotice() {
  return (
    <div className="panel rounded-2xl p-4 ring-1 ring-hairline sm:p-5">
      <div className="flex gap-3">
        {/* Status colour never carries meaning alone — icon plus label. */}
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
              Research demonstration — synthetic data only.
            </strong>{" "}
            Every slice on this page is computer-generated. No patient data is used,
            shown, or implied. This is a proof of concept, not a clinically validated
            medical device.
          </p>
          <p className="caption text-ink-secondary">
            <strong className="font-semibold text-ink-primary">
              The human stays in charge.
            </strong>{" "}
            The system never says “this patient needs a biopsy here.” It says “under
            this simulated tumour geometry, this sampling strategy produced better
            coverage.” Deciding where a biopsy is actually taken is a clinician&apos;s
            judgement, and nothing here substitutes for it.
          </p>
        </div>
      </div>
    </div>
  );
}
