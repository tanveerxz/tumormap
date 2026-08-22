"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPointCloud } from "@/lib/api";
import { REGION_TOKEN_BY_ID } from "@/lib/regionColors";
import type { PointCloud } from "@/lib/types";

interface Props {
  /** Locked viewing angle, so the thumbnail is reproducible across renders. */
  yaw?: number;
  pitch?: number;
  className?: string;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  );
}

/**
 * A still of the real segmentation, for the project cover.
 *
 * Fixed angle and no interaction — this is a portrait of the data, not the
 * explorer. It renders the same surface voxels the walkthrough uses, so the
 * thumbnail is the actual tumour rather than an illustration of one.
 */
export default function ProjectThumbnail({
  yaw = 0.7,
  pitch = -0.32,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cloud, setCloud] = useState<PointCloud | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPointCloud(1200, controller.signal)
      .then(setCloud)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !cloud) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const scale = Math.min(w, h) * 0.82;

    const points: Array<{ x: number; y: number; d: number; c: string }> = [];
    for (const region of cloud.regions) {
      const colour = readToken(REGION_TOKEN_BY_ID[region.id], "#2a78d6");
      for (const p of region.points) {
        const x1 = p[0] * cy - p[2] * sy;
        const z1 = p[0] * sy + p[2] * cy;
        const y1 = p[1] * cp - z1 * sp;
        const z2 = p[1] * sp + z1 * cp;
        const persp = 1 / (1.9 + z2);
        points.push({
          x: w / 2 + x1 * scale * persp * 1.9,
          y: h / 2 + y1 * scale * persp * 1.9,
          d: z2,
          c: colour,
        });
      }
    }

    // Painter's algorithm: far points first so near ones sit on top.
    points.sort((a, b) => b.d - a.d);
    for (const p of points) {
      const t = Math.max(0, Math.min(1, (p.d + 0.55) / 1.1));
      ctx.globalAlpha = 0.25 + (1 - t) * 0.6;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.1 + (1 - t) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [cloud, yaw, pitch]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      {!cloud && (
        <div className="caption absolute inset-0 grid place-items-center text-ink-muted">
          {failed ? "Start the server to render the volume" : "Rendering volume…"}
        </div>
      )}
      <span className="sr-only">
        Three-dimensional rendering of a glioblastoma segmentation, showing the necrotic
        core, infiltrative margin, and enhancing rim as three coloured regions.
      </span>
    </div>
  );
}
