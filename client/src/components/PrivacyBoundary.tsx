/**
 * The architectural claim, drawn rather than asserted: sensitive material stays
 * local while the cloud model does the heavy reasoning. What crosses the
 * boundary is a few lines of structured text, never the image.
 */
export default function PrivacyBoundary() {
  return (
    <div className="panel overflow-hidden rounded-2xl ring-1 ring-hairline">
      <div className="grid md:grid-cols-[1fr_auto_1fr]">
        {/* On-device side */}
        <div className="p-5">
          <div className="label-mono mb-3 flex items-center gap-2 text-ink-secondary">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--brand)" }}
            />
            On device
          </div>
          <ul className="caption space-y-1.5 text-ink-secondary">
            <li className="text-ink-primary">MRI slice · raw pixels</li>
            <li>Region segmentation</li>
            <li>Volume shares per region</li>
          </ul>
          <p className="label-mono mt-4 text-brand">Never transmitted</p>
        </div>

        {/* The boundary itself */}
        <div className="relative flex items-center justify-center px-5 py-2 md:px-4">
          <span
            aria-hidden
            className="absolute inset-x-5 top-1/2 border-t border-dashed border-axis md:inset-x-auto md:inset-y-5 md:left-1/2 md:border-l md:border-t-0"
          />
          <span className="label-mono relative rounded-full bg-surface-2 px-3 py-1.5 text-ink-secondary ring-1 ring-hairline">
            <span aria-hidden className="mr-1.5">
              →
            </span>
            summary text only
          </span>
        </div>

        {/* Cloud side */}
        <div className="p-5">
          <div className="label-mono mb-3 flex items-center gap-2 text-ink-secondary">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            Cloud
          </div>
          <ul className="caption space-y-1.5 text-ink-secondary">
            <li className="text-ink-primary">Structured region summary</li>
            <li>Sampling strategy reasoning</li>
            <li>Pass allocation returned</li>
          </ul>
          <p className="label-mono mt-4 text-ink-muted">No image, no identifiers</p>
        </div>
      </div>

      <p className="caption border-t border-grid px-5 py-3 text-ink-secondary">
        Sensitive material stays local while the cloud model handles the
        computationally intensive reasoning.
      </p>
    </div>
  );
}
