import React, { useMemo } from 'react';
import { OmicsFeature } from '../types/omics';
import { classifyFeature } from '../utils/omicsParser';

interface PathwayDistributionProps {
  features: OmicsFeature[];
  fcThreshold: number;
  pThreshold: number;
  activePathwayFilter: string | null;
  onSelectPathway: (pathway: string | null) => void;
}

export const PathwayDistribution: React.FC<PathwayDistributionProps> = ({
  features,
  fcThreshold,
  pThreshold,
  activePathwayFilter,
  onSelectPathway,
}) => {
  const pathways = useMemo(() => {
    const map = new Map<string, { up: number; down: number; total: number }>();
    for (const f of features) {
      const status = classifyFeature(f, fcThreshold, pThreshold);
      if (status === 'unchanged') continue;
      const entry = map.get(f.pathway) ?? { up: 0, down: 0, total: 0 };
      if (status === 'upregulated') entry.up += 1;
      if (status === 'downregulated') entry.down += 1;
      entry.total += 1;
      map.set(f.pathway, entry);
    }

    return Array.from(map.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [features, fcThreshold, pThreshold]);

  const maxCount = Math.max(1, ...pathways.map((p) => p.total));

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Significant Pathway Breakdown
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Click a pathway bar to filter features
          </p>
        </div>
        {activePathwayFilter && (
          <button
            type="button"
            onClick={() => onSelectPathway(null)}
            className="text-xs font-medium text-[#BE185D] hover:underline whitespace-nowrap"
          >
            Clear filter
          </button>
        )}
      </div>

      {pathways.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10 text-xs text-zinc-500">
          No features pass the current significance thresholds.
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {pathways.map((pw) => {
            const upPct = (pw.up / maxCount) * 100;
            const downPct = (pw.down / maxCount) * 100;
            const isSelected = activePathwayFilter === pw.name;

            return (
              <button
                key={pw.name}
                type="button"
                onClick={() => onSelectPathway(isSelected ? null : pw.name)}
                className={`w-full text-left group rounded px-2 py-1.5 -mx-2 transition-colors ${
                  isSelected ? 'bg-[#FDF2F8]' : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span
                    className={`font-medium truncate pr-2 ${
                      isSelected ? 'text-[#BE185D]' : 'text-zinc-800'
                    }`}
                  >
                    {pw.name}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-zinc-500 shrink-0">
                    {pw.up > 0 && <span className="text-[#BE185D]">+{pw.up}</span>}
                    {pw.up > 0 && pw.down > 0 && <span className="mx-1 text-zinc-300">/</span>}
                    {pw.down > 0 && <span className="text-zinc-700">−{pw.down}</span>}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-zinc-100 rounded-xs overflow-hidden flex">
                  {pw.up > 0 && (
                    <div
                      className="h-full bg-[#DB2777] transition-all duration-150"
                      style={{ width: `${upPct}%` }}
                    />
                  )}
                  {pw.down > 0 && (
                    <div
                      className="h-full bg-zinc-600 transition-all duration-150"
                      style={{ width: `${downPct}%` }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
