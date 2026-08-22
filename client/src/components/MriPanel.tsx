"use client";

import { useEffect, useState } from "react";
import InfoTip from "./InfoTip";
import { fetchSlice } from "@/lib/api";
import type { MriSlice } from "@/lib/types";

const MODALITIES = [
  { id: "T1_post", label: "T1 + Gd", term: "T1 + Gd", blurb: "Shows the active tumour" },
  { id: "T1_pre", label: "T1", term: "T1", blurb: "The plain 'before dye' scan" },
  { id: "T2", label: "T2", term: "T2", blurb: "Fluid and swelling show bright" },
  { id: "FLAIR", label: "FLAIR", term: "FLAIR", blurb: "Invaded tissue stands out" },
];

/**
 * The actual scans, shown on their own.
 *
 * Deliberately carries NO segmentation overlay: the mask is in MNI152 space
 * and these are native space, so drawing the tumour outline on top would put
 * it in the wrong anatomical place. Showing them side by side is the honest
 * presentation given the published files.
 */
export default function MriPanel() {
  const [modality, setModality] = useState("T1_post");
  const [slice, setSlice] = useState<MriSlice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived, not stored: the panel is loading whenever what we're showing is
  // not what was asked for. This is what stops a scan switch from silently
  // displaying the previous sequence as though it were the new one.
  const loading = !error && (!slice || slice.modality !== modality);

  useEffect(() => {
    const controller = new AbortController();
    fetchSlice(modality, "axial", controller.signal)
      .then((next) => {
        setSlice(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load scan");
      });
    return () => controller.abort();
  }, [modality]);

  const active = MODALITIES.find((m) => m.id === modality);

  return (
    <div>
      <p className="caption mb-3 text-ink-secondary">
        The same slice of the same brain, photographed four ways. Each{" "}
        <InfoTip term="mri">tuning</InfoTip> makes different tissue stand out — which is
        how the tumour&apos;s parts are told apart.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODALITIES.map((m) => {
          const isActive = modality === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setModality(m.id)}
              title={m.blurb}
              aria-pressed={isActive}
              className="press label-mono rounded-lg px-2.5 py-1.5 ring-1 ring-hairline"
              style={{
                background: isActive ? "var(--brand)" : "var(--surface-2)",
                color: isActive ? "var(--brand-ink)" : "var(--ink-secondary)",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black ring-1 ring-hairline">
        {slice && (
          // Keyed on the loaded modality so React remounts it on every swap,
          // which restarts the entrance animation. A cached slice can return in
          // single-digit milliseconds, and without a deliberate entrance two
          // near-identical greyscale images swapping that fast read as "nothing
          // happened".
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slice.modality}
            src={slice.png}
            alt={`${slice.modality} scan, axial slice ${slice.sliceIndex}`}
            className={`h-full w-full object-contain transition-opacity duration-200 ${
              loading ? "" : "scan-in"
            }`}
            style={{ opacity: loading ? 0.25 : 1 }}
          />
        )}

        {loading && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-2.5">
              <span
                aria-hidden
                className="block h-6 w-6 animate-spin rounded-full border-2 border-transparent"
                style={{
                  borderTopColor: "var(--brand)",
                  borderRightColor: "var(--brand)",
                }}
              />
              <span className="label-mono text-ink-secondary" role="status">
                Loading {active?.label ?? modality}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="caption absolute inset-0 grid place-items-center px-4 text-center text-ink-muted">
            {error}
          </div>
        )}
      </div>

      {active && (
        <p className="caption mt-2.5 text-ink-secondary">
          <InfoTip term={active.term}>{active.label}</InfoTip> — {active.blurb}.
        </p>
      )}

      {slice && !loading && (
        <p className="mono mt-1.5 text-xs text-ink-muted">
          slice {slice.sliceIndex} · {slice.width}×{slice.height} ·{" "}
          <InfoTip term="native space">native space</InfoTip>
        </p>
      )}
    </div>
  );
}
