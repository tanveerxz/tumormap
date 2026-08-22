"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REGION_IDS, REGION_PROFILE } from "@/lib/tumour";
import type { BiopsyPath, TumourMap } from "@/lib/types";

interface Props {
  map: TumourMap;
  paths?: BiopsyPath[];
  /** Changing this forces a repaint when the palette swaps. */
  themeKey: string;
  /** Dim the render during a refetch instead of flashing a skeleton. */
  pending?: boolean;
}

interface Hover {
  x: number;
  y: number;
  label: number;
  intensity: number;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export default function TumourSlice({ map, paths, themeKey, pending = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssSize = canvas.clientWidth;
    if (cssSize === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);

    const regionRgb = [
      hexToRgb(readToken("--region-a", "#2a78d6")),
      hexToRgb(readToken("--region-b", "#eb6834")),
      hexToRgb(readToken("--region-c", "#1baf7a")),
    ];
    const needle = readToken("--needle", "#0b0b0b");
    const halo = readToken("--needle-halo", "#fcfcfb");
    const plane = readToken("--plane", "#f9f9f7");

    // 1. Paint the slice at native grid resolution, then scale it up. Letting
    //    the browser interpolate is what gives it the soft MRI look.
    const buffer = document.createElement("canvas");
    buffer.width = map.width;
    buffer.height = map.height;
    const bufferCtx = buffer.getContext("2d");
    if (!bufferCtx) return;

    const image = bufferCtx.createImageData(map.width, map.height);
    const planeRgb = hexToRgb(plane);

    for (let i = 0; i < map.labels.length; i++) {
      const grey = Math.round(map.intensity[i] * 255);
      const label = map.labels[i];
      let r = grey;
      let g = grey;
      let b = grey;

      if (label >= 1 && label <= 3) {
        // Tint the greyscale with the region hue — the underlying signal stays
        // readable, which is the point of an overlay rather than a flat fill.
        const [tr, tg, tb] = regionRgb[label - 1];
        const alpha = 0.62;
        r = Math.round(grey * (1 - alpha) + tr * alpha);
        g = Math.round(grey * (1 - alpha) + tg * alpha);
        b = Math.round(grey * (1 - alpha) + tb * alpha);
      } else if (map.intensity[i] === 0) {
        [r, g, b] = planeRgb;
      }

      const o = i * 4;
      image.data[o] = r;
      image.data[o + 1] = g;
      image.data[o + 2] = b;
      image.data[o + 3] = 255;
    }
    bufferCtx.putImageData(image, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buffer, 0, 0, cssSize, cssSize);

    if (!paths || paths.length === 0) return;

    // 2. Needle paths. Neutral ink with a surface halo so they stay legible
    //    over every region hue — identity comes from the panel, not colour.
    //    Misses are drawn fainter: a secondary encoding, no extra hue.
    ctx.lineCap = "round";
    for (const path of paths) {
      const ex = path.entry.x * cssSize;
      const ey = path.entry.y * cssSize;
      const tx = path.target.x * cssSize;
      const ty = path.target.y * cssSize;

      ctx.globalAlpha = path.hit ? 0.3 : 0.12;
      ctx.strokeStyle = halo;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.strokeStyle = needle;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // 3. Core tips last, so they sit above every shaft.
    for (const path of paths) {
      const tx = path.target.x * cssSize;
      const ty = path.target.y * cssSize;

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(tx, ty, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      ctx.globalAlpha = path.hit ? 0.95 : 0.4;
      ctx.beginPath();
      ctx.arc(tx, ty, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = needle;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [map, paths]);

  useEffect(() => {
    draw();
  }, [draw, themeKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const col = Math.floor(nx * map.width);
    const row = Math.floor(ny * map.height);
    if (col < 0 || row < 0 || col >= map.width || row >= map.height) {
      setHover(null);
      return;
    }
    const i = row * map.width + col;
    setHover({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      label: map.labels[i],
      intensity: map.intensity[i],
    });
  };

  const hoveredRegion =
    hover && hover.label >= 1 && hover.label <= 3 ? REGION_IDS[hover.label - 1] : null;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        className="block w-full aspect-square rounded-lg ring-1 ring-hairline transition-opacity duration-200"
        style={{ opacity: pending ? 0.45 : 1 }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md px-2 py-1.5 text-xs shadow-lg ring-1 ring-hairline"
          style={{
            background: "var(--surface-1)",
            color: "var(--ink-primary)",
            left: Math.min(hover.x + 12, 999),
            top: hover.y + 12,
          }}
        >
          <div className="font-medium">
            {hoveredRegion
              ? REGION_PROFILE[hoveredRegion].label
              : hover.intensity > 0
                ? "Non-tumour tissue"
                : "Outside head"}
          </div>
          <div className="mono tabular text-ink-secondary">
            signal {hover.intensity.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
