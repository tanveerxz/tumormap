"use client";

import { useState } from "react";
import { pct } from "@/lib/format";
import { REGION_VAR_BY_ID } from "@/lib/regionColors";
import type { CaseFeatures, CompartmentId, StrategyResult } from "@/lib/types";

interface Props {
  features: CaseFeatures;
  result: StrategyResult;
  pending?: boolean;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Share of collected tissue drawn from each compartment, against the share
 * that compartment actually occupies. The axis is fixed 0–100% in every panel
 * so the two strategies can be compared side by side.
 */
export default function RegionBalance({ features, result, pending = false }: Props) {
  const [hovered, setHovered] = useState<CompartmentId | null>(null);

  return (
    <div className="transition-opacity duration-200" style={{ opacity: pending ? 0.55 : 1 }}>
      <div className="space-y-3">
        {features.regions.map((region) => {
          const sampled = result.sampledShare[region.id] ?? 0;
          const isHovered = hovered === region.id;
          const missed = sampled === 0;

          return (
            <div
              key={region.id}
              onMouseEnter={() => setHovered(region.id)}
              onMouseLeave={() => setHovered(null)}
              className="relative cursor-default py-1"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-ink-secondary">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ background: REGION_VAR_BY_ID[region.id] }}
                  />
                  {region.short}
                </span>
                <span className="mono tabular text-ink-primary">
                  {pct(sampled)}
                  {missed && (
                    <span className="ml-1.5 font-medium" style={{ color: "var(--accent)" }}>
                      not sampled
                    </span>
                  )}
                </span>
              </div>

              <div className="relative h-5 w-full rounded-[3px] bg-surface-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-l-[3px] transition-[width] duration-300"
                  style={{
                    width: `${Math.max(sampled * 100, sampled > 0 ? 0.8 : 0)}%`,
                    background: REGION_VAR_BY_ID[region.id],
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                    opacity: hovered && !isHovered ? 0.55 : 1,
                  }}
                />
                {/* True share reference: hairline with a surface halo so it
                    stays visible on the fill or on the track. */}
                <div
                  aria-hidden
                  className="absolute -top-0.5 -bottom-0.5 w-[4px] rounded-full bg-surface-1"
                  style={{ left: `calc(${region.trueShare * 100}% - 2px)` }}
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
                <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-md bg-surface-1 px-2 py-1.5 text-xs shadow-lg ring-1 ring-hairline">
                  <div className="font-medium text-ink-primary">{region.name}</div>
                  <div className="mono tabular text-ink-secondary">
                    sampled {pct(sampled, 1)} · true {pct(region.trueShare, 1)} ·{" "}
                    {region.volumeCm3} cm³
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
