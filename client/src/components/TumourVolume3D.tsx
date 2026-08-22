"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REGION_TOKEN_BY_ID } from "@/lib/regionColors";
import type { BiopsyPass, CompartmentId, PointCloud } from "@/lib/types";

interface Props {
  cloud: PointCloud;
  /** Needle tracks to overlay, in voxel coordinates. */
  passes?: BiopsyPass[];
  /** Volume dimensions, to normalise pass coordinates into the same cube. */
  shape?: [number, number, number];
  visible?: Record<CompartmentId, boolean>;
  themeKey: string;
  /** Slowly orbit when the user is not dragging. */
  autoRotate?: boolean;
}

interface Projected {
  x: number;
  y: number;
  depth: number;
  color: string;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  );
}

/** Exponential-decay momentum, the same curve scroll deceleration uses. */
const DECELERATION = 0.94;
const MIN_VELOCITY = 0.00002;

export default function TumourVolume3D({
  cloud,
  passes,
  shape,
  visible,
  themeKey,
  autoRotate = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  // Rotation state lives in a ref, not React state: it updates every frame and
  // re-rendering the tree 60x a second would be pointless work.
  const rotation = useRef({ yaw: 0.6, pitch: -0.35 });
  const velocity = useRef({ yaw: 0, pitch: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0, t: 0 });

  const [isDragging, setIsDragging] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const size = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (size === 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, height);

    const { yaw, pitch } = rotation.current;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);

    const cx = size / 2;
    const cyc = height / 2;
    const scale = Math.min(size, height) * 0.78;

    // Rotate about Y then X, then a weak perspective divide.
    const project = (p: readonly number[]): { x: number; y: number; d: number } => {
      const x1 = p[0] * cy - p[2] * sy;
      const z1 = p[0] * sy + p[2] * cy;
      const y1 = p[1] * cp - z1 * sp;
      const z2 = p[1] * sp + z1 * cp;
      const perspective = 1 / (1.9 + z2);
      return { x: cx + x1 * scale * perspective * 1.9, y: cyc + y1 * scale * perspective * 1.9, d: z2 };
    };

    const points: Projected[] = [];
    for (const region of cloud.regions) {
      if (visible && visible[region.id] === false) continue;
      const color = readToken(REGION_TOKEN_BY_ID[region.id], "#2a78d6");
      for (const p of region.points) {
        const { x, y, d } = project(p);
        points.push({ x, y, depth: d, color });
      }
    }

    // Painter's algorithm: far points first so near ones sit on top.
    points.sort((a, b) => b.depth - a.depth);

    for (const p of points) {
      // Depth cue: nearer points are larger and more opaque.
      const t = Math.max(0, Math.min(1, (p.depth + 0.55) / 1.1));
      ctx.globalAlpha = 0.25 + (1 - t) * 0.6;
      ctx.fillStyle = p.color;
      const r = 1.1 + (1 - t) * 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Needle tracks, drawn as neutral ink over the volume.
    if (passes && shape) {
      const needle = readToken("--needle", "#0d1520");
      const halo = readToken("--needle-halo", "#fbfcfd");
      const dims = shape;
      const maxDim = Math.max(...dims);
      const norm = (v: readonly number[]) =>
        [
          (v[0] / dims[0] - 0.5) * (dims[0] / maxDim),
          (v[1] / dims[1] - 0.5) * (dims[1] / maxDim),
          (v[2] / dims[2] - 0.5) * (dims[2] / maxDim),
        ] as const;

      ctx.lineCap = "round";
      for (const pass of passes) {
        const a = project(norm(pass.entry));
        const b = project(norm(pass.target));

        ctx.globalAlpha = pass.hit ? 0.3 : 0.12;
        ctx.strokeStyle = halo;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.strokeStyle = needle;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const pass of passes) {
        const b = project(norm(pass.target));
        ctx.globalAlpha = 1;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = pass.hit ? 0.95 : 0.4;
        ctx.fillStyle = needle;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }, [cloud, passes, shape, visible]);

  // Animation loop: applies idle orbit and post-release momentum, then draws.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tick = () => {
      if (!dragging.current) {
        const v = velocity.current;
        if (Math.abs(v.yaw) > MIN_VELOCITY || Math.abs(v.pitch) > MIN_VELOCITY) {
          // Carry the release velocity forward and let it decay, so letting go
          // of a flick throws the volume rather than stopping it dead.
          rotation.current.yaw += v.yaw;
          rotation.current.pitch += v.pitch;
          v.yaw *= DECELERATION;
          v.pitch *= DECELERATION;
        } else if (autoRotate && !reduced) {
          rotation.current.yaw += 0.0022;
        }
        rotation.current.pitch = Math.max(-1.3, Math.min(1.3, rotation.current.pitch));
      }
      draw();
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw, autoRotate, themeKey]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    setIsDragging(true);
    velocity.current = { yaw: 0, pitch: 0 };
    last.current = { x: event.clientX, y: event.clientY, t: performance.now() };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const now = performance.now();
    const dx = event.clientX - last.current.x;
    const dy = event.clientY - last.current.y;
    const dt = Math.max(now - last.current.t, 1);

    // 1:1 tracking — the volume turns exactly as far as the pointer moved.
    const dYaw = dx * 0.008;
    const dPitch = dy * 0.008;
    rotation.current.yaw += dYaw;
    rotation.current.pitch += dPitch;

    // Keep per-frame velocity for the handoff at release.
    velocity.current = { yaw: (dYaw / dt) * 16, pitch: (dPitch / dt) * 16 };
    last.current = { x: event.clientX, y: event.clientY, t: now };
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = false;
    setIsDragging(false);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="block h-full w-full touch-none select-none rounded-xl"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      aria-label="Interactive 3D view of the tumour segmentation. Drag to rotate."
      role="img"
    />
  );
}
