import { REGION_VAR_BY_ID as REGION_VAR } from "@/lib/regionColors";
import { REGION_IDS, REGION_PROFILE } from "@/lib/tumour";

/** Always present: with three regions on screen, identity is never colour-alone. */
export default function RegionLegend({ showReference = false }: { showReference?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {REGION_IDS.map((id) => (
        <span key={id} className="flex items-center gap-1.5 text-ink-secondary">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-xs"
            style={{ background: REGION_VAR[id] }}
          />
          {REGION_PROFILE[id].label}
          <span className="text-ink-muted">
            · {REGION_PROFILE[id].character.replace("-", " ")}
          </span>
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
