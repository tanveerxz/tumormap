"use client";

import { useEffect, useRef, useState } from "react";
import { fetchSlice } from "@/lib/api";
import type { MriSlice } from "@/lib/types";

const MODALITIES = [
  { id: "T1_post", label: "T1 + Gd" },
  { id: "T1_pre", label: "T1" },
  { id: "T2", label: "T2" },
  { id: "FLAIR", label: "FLAIR" },
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modality, setModality] = useState("T1_post");
  const [slice, setSlice] = useState<MriSlice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchSlice(modality, "axial", controller.signal)
      .then((next) => {
        setSlice(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load slice");
      });
    return () => controller.abort();
  }, [modality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !slice) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = document.createElement("canvas");
    buffer.width = slice.width;
    buffer.height = slice.height;
    const bctx = buffer.getContext("2d");
    if (!bctx) return;

    const image = bctx.createImageData(slice.width, slice.height);
    for (let i = 0; i < slice.pixels.length; i++) {
      const v = slice.pixels[i];
      const o = i * 4;
      image.data[o] = v;
      image.data[o + 1] = v;
      image.data[o + 2] = v;
      image.data[o + 3] = 255;
    }
    bctx.putImageData(image, 0, 0);

    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);

    // Letterbox rather than stretch — aspect matters on a medical image.
    const scale = Math.min(size / slice.width, size / slice.height);
    const w = slice.width * scale;
    const h = slice.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buffer, (size - w) / 2, (size - h) / 2, w, h);
  }, [slice]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODALITIES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModality(m.id)}
            className="press label-mono rounded-lg px-2.5 py-1.5 ring-1 ring-hairline"
            style={{
              background: modality === m.id ? "var(--brand)" : "var(--surface-2)",
              color: modality === m.id ? "var(--brand-ink)" : "var(--ink-secondary)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="block aspect-square w-full rounded-xl ring-1 ring-hairline"
          style={{ background: "#000" }}
        />
        {!slice && !error && (
          <div className="caption absolute inset-0 grid place-items-center text-ink-muted">
            Loading scan…
          </div>
        )}
        {error && (
          <div className="caption absolute inset-0 grid place-items-center px-4 text-center text-ink-muted">
            {error}
          </div>
        )}
      </div>

      {slice && (
        <p className="mono mt-2.5 text-xs text-ink-muted">
          {slice.modality} · {slice.plane} · slice {slice.sliceIndex} · {slice.width}×
          {slice.height} · {slice.space} space
        </p>
      )}
      <p className="caption mt-1.5 text-ink-muted">
        Shown without a segmentation overlay — this scan and the mask are in different
        coordinate spaces.
      </p>
    </div>
  );
}
