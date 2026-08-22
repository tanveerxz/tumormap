import { pct } from "@/lib/format";
import { REGION_VAR_BY_ID } from "@/lib/regionColors";
import type { RunResult } from "@/lib/types";

/**
 * The table view — the WCAG-clean twin of every chart on the page. It is also
 * the relief for the light-mode contrast warning on the aqua region swatch:
 * every value shown by colour is also available as text here.
 */
export default function RegionTable({ run }: { run: RunResult }) {
  const traditional = run.results.traditional;
  const guided = run.results["ai-guided"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">
          Tumour volume share by region against the share of tissue each sampling
          strategy collected from it.
        </caption>
        <thead>
          <tr className="border-b border-axis text-left">
            <th scope="col" className="py-2 pr-4 font-medium text-ink-secondary">
              Region
            </th>
            <th scope="col" className="py-2 pr-4 font-medium text-ink-secondary">
              Character
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium text-ink-secondary">
              True share
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium text-ink-secondary">
              Traditional
            </th>
            <th scope="col" className="py-2 text-right font-medium text-ink-secondary">
              AI-guided
            </th>
          </tr>
        </thead>
        <tbody>
          {run.map.regions.map((region) => (
            <tr key={region.id} className="border-b border-grid">
              <th scope="row" className="py-2 pr-4 text-left font-normal">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ background: REGION_VAR_BY_ID[region.id] }}
                  />
                  {region.label}
                </span>
              </th>
              <td className="py-2 pr-4 text-ink-secondary">
                {region.character.replace("-", " ")}
              </td>
              <td className="mono tabular py-2 pr-4 text-right">{pct(region.trueShare, 1)}</td>
              <td className="mono tabular py-2 pr-4 text-right">
                {pct(traditional.metrics.sampledShare[region.id], 1)}
              </td>
              <td className="mono tabular py-2 text-right">
                {pct(guided.metrics.sampledShare[region.id], 1)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-ink-secondary">
            <td className="py-2 pr-4" colSpan={2}>
              Representative coverage
            </td>
            <td className="py-2 pr-4 text-right text-ink-muted">—</td>
            <td className="mono tabular py-2 pr-4 text-right">
              {pct(traditional.metrics.representativeCoverage)}
            </td>
            <td className="mono tabular py-2 text-right">
              {pct(guided.metrics.representativeCoverage)}
            </td>
          </tr>
          <tr className="text-ink-secondary">
            <td className="py-2 pr-4" colSpan={2}>
              Tumour hit rate
            </td>
            <td className="py-2 pr-4 text-right text-ink-muted">—</td>
            <td className="mono tabular py-2 pr-4 text-right">{pct(traditional.metrics.hitRate)}</td>
            <td className="mono tabular py-2 text-right">{pct(guided.metrics.hitRate)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
