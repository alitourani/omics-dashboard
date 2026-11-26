import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { OmicsFeature, RegulationStatus } from '../types/omics';
import { classifyFeature } from '../utils/omicsParser';

interface FeatureTableProps {
  features: OmicsFeature[];
  fcThreshold: number;
  pThreshold: number;
  regulationFilter: 'all' | 'upregulated' | 'downregulated';
  onChangeRegulationFilter: (val: 'all' | 'upregulated' | 'downregulated') => void;
  selectedFeatureId: string | null;
  onSelectFeature: (feature: OmicsFeature) => void;
  compact?: boolean;
}

type SortKey = 'id' | 'pathway' | 'log2FoldChange' | 'adjPValue' | 'baseMean';

export const FeatureTable: React.FC<FeatureTableProps> = ({
  features,
  fcThreshold,
  pThreshold,
  regulationFilter,
  onChangeRegulationFilter,
  selectedFeatureId,
  onSelectFeature,
  compact = false,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('adjPValue');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'id' || key === 'pathway' || key === 'adjPValue');
    }
  };

  const rows = useMemo(() => {
    const withStatus = features.map((f) => ({
      feature: f,
      status: classifyFeature(f, fcThreshold, pThreshold),
    }));

    const filtered =
      regulationFilter === 'all'
        ? withStatus
        : withStatus.filter((r) => r.status === regulationFilter);

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'id') cmp = a.feature.id.localeCompare(b.feature.id);
      else if (sortKey === 'pathway') cmp = a.feature.pathway.localeCompare(b.feature.pathway);
      else cmp = a.feature[sortKey] - b.feature[sortKey];
      return sortAsc ? cmp : -cmp;
    });

    return compact ? filtered.slice(0, 12) : filtered;
  }, [features, fcThreshold, pThreshold, regulationFilter, sortKey, sortAsc, compact]);

  const statusLabel = (status: RegulationStatus) => {
    if (status === 'upregulated') {
      return <span className="text-[#BE185D] font-medium">▲ Up</span>;
    }
    if (status === 'downregulated') {
      return <span className="text-zinc-700 font-medium">▼ Down</span>;
    }
    return <span className="text-zinc-400">− Unchanged</span>;
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
      {/* Header Toolbar */}
      <div className="px-5 py-3.5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            {compact ? 'Top Significant Features' : 'Complete Feature Expression Table'}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
            Showing {rows.length} of {features.length} features
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 rounded-md">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'upregulated', label: 'Upregulated' },
              { id: 'downregulated', label: 'Downregulated' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeRegulationFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                regulationFilter === tab.id
                  ? 'bg-white text-[#BE185D] shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="py-2.5 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('id')}
                  className="inline-flex items-center gap-1 hover:text-zinc-900"
                >
                  <span>Feature</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('pathway')}
                  className="inline-flex items-center gap-1 hover:text-zinc-900"
                >
                  <span>Pathway</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-4 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('log2FoldChange')}
                  className="inline-flex items-center justify-end gap-1 hover:text-zinc-900 ml-auto"
                >
                  <span>log2FC</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-4 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('adjPValue')}
                  className="inline-flex items-center justify-end gap-1 hover:text-zinc-900 ml-auto"
                >
                  <span>Adj. p-value</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-4 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('baseMean')}
                  className="inline-flex items-center justify-end gap-1 hover:text-zinc-900 ml-auto"
                >
                  <span>Mean Expr</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-4">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-xs">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-zinc-500">
                  No features match the active search or regulation filter.
                </td>
              </tr>
            ) : (
              rows.map(({ feature, status }) => {
                const isSelected = feature.id === selectedFeatureId;
                return (
                  <tr
                    key={feature.id}
                    onClick={() => onSelectFeature(feature)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#FDF2F8]'
                        : 'hover:bg-zinc-50'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-zinc-900">
                      <div>{feature.id}</div>
                      {feature.description && !compact && (
                        <div className="text-[11px] font-sans font-normal text-zinc-500 truncate max-w-[240px]">
                          {feature.description}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-600">{feature.pathway}</td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-medium ${
                        feature.log2FoldChange >= fcThreshold
                          ? 'text-[#BE185D]'
                          : feature.log2FoldChange <= -fcThreshold
                          ? 'text-zinc-900'
                          : 'text-zinc-500'
                      }`}
                    >
                      {feature.log2FoldChange >= 0 ? '+' : ''}
                      {feature.log2FoldChange.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-700">
                      {feature.adjPValue.toExponential(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-600">
                      {feature.baseMean.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{statusLabel(status)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
