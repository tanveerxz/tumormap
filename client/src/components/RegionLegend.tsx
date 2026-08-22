import { COMPARTMENT_ORDER, REGION_VAR_BY_ID } from "@/lib/regionColors";
import type { CaseFeatures } from "@/lib/types";

interface Props {
  features?: CaseFeatures;
  showReference?: boolean;
  showShare?: boolean;
}

/** Always present: with three compartments on screen, identity is never colour-alone. */
export default function RegionLegend({ features, showReference, showShare }: Props) {
  const items =
    features?.regions.map((r) => ({
      id: r.id,
      label: r.short,
      share: r.trueShare,
    })) ?? COMPARTMENT_ORDER.map((id) => ({ id, label: id, share: undefined }));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {items.map((item) => (
        <span key={item.id} className="flex items-center gap-1.5 text-ink-secondary">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
            style={{ background: REGION_VAR_BY_ID[item.id] }}
          />
          {item.label}
          {showShare && item.share !== undefined && (
            <span className="mono tabular text-ink-muted">
              {(item.share * 100).toFixed(0)}%
            </span>
          )}
        </span>
      ))}
      {showReference && (
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <span
            aria-hidden
            className="inline-block h-3 w-[1.5px]"
            style={{ background: "var(--ink-secondary)" }}
          />
          true volume share
        </span>
      )}
    </div>
  );
}
