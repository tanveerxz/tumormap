"use client";

import { useState } from "react";
import { pct } from "@/lib/format";
import { REGION_VAR_BY_ID as REGION_VAR } from "@/lib/regionColors";
import { REGION_IDS } from "@/lib/tumour";
import type { RegionId, StrategyResult, TumourMap } from "@/lib/types";

interface Props {
  map: TumourMap;
  result: StrategyResult;
  pending?: boolean;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Share of collected tissue drawn from each region, against the share that
 * region actually represents. The axis is fixed 0–100% in every panel so the
 * two strategies can be compared side by side.
 */
export default function RegionBalance({ map, result, pending = false }: Props) {
  const [hovered, setHovered] = useState<RegionId | null>(null);

  return (
    <div className="transition-opacity duration-200" style={{ opacity: pending ? 0.55 : 1 }}>
      <div className="space-y-3">
        {REGION_IDS.map((id) => {
          const region = map.regions.find((r) => r.id === id);
          if (!region) return null;
          const sampled = result.metrics.sampledShare[id];
          const isHovered = hovered === id;

          return (
            <div
              key={id}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              // Hit target covers the whole row, not just the fill.
              className="relative cursor-default py-1"
            >
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-secondary">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-xs"
                    style={{ background: REGION_VAR[id] }}
                  />
                  {region.label}
                </span>
                {/* Direct label — the relief for light-mode contrast, and it
                    means no value is reachable only through a tooltip. */}
                <span className="mono tabular text-ink-primary">{pct(sampled)}</span>
              </div>

              <div
                className="relative h-5 w-full rounded-[3px]"
                style={{ background: "var(--surface-2)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-l-[3px] transition-[width] duration-300"
                  style={{
                    width: `${Math.max(sampled * 100, sampled > 0 ? 0.8 : 0)}%`,
                    background: REGION_VAR[id],
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                    opacity: hovered && !isHovered ? 0.55 : 1,
                  }}
                />
                {/* True share reference: a hairline rule with a surface halo so
                    it stays visible whether it lands on the fill or the track. */}
                <div
                  aria-hidden
                  className="absolute -top-0.5 -bottom-0.5 w-[4px] rounded-full"
                  style={{
                    left: `calc(${region.trueShare * 100}% - 2px)`,
                    background: "var(--surface-1)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute -top-0.5 -bottom-0.5 w-[1.5px]"
                  style={{
                    left: `calc(${region.trueShare * 100}% - 0.75px)`,
                    background: "var(--ink-secondary)",
                  }}
                />
              </div>

              {isHovered && (
                <div
                  className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-md px-2 py-1.5 text-xs shadow-lg ring-1 ring-hairline"
                  style={{ background: "var(--surface-1)" }}
                >
                  <div className="font-medium text-ink-primary">{region.label}</div>
                  <div className="mono tabular text-ink-secondary">
                    sampled {pct(sampled, 1)} · true {pct(region.trueShare, 1)}
                  </div>
                  <div className="mono tabular text-ink-muted">
                    {region.character.replace("-", " ")}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recessive axis: solid hairline ticks, one shade off the surface. */}
      <div className="relative mt-2 h-4 border-t border-grid">
        {TICKS.map((tick) => (
          <span
            key={tick}
            className="mono tabular absolute top-1 -translate-x-1/2 text-[10px] text-ink-muted"
            style={{ left: `${tick * 100}%` }}
          >
            {tick * 100}%
          </span>
        ))}
      </div>
    </div>
  );
}
