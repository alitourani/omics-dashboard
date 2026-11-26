import React, { useMemo, useState } from 'react';
import { OmicsFeature } from '../types/omics';
import { getGrayToMagentaColor } from '../utils/omicsParser';

interface ExpressionHeatmapProps {
  features: OmicsFeature[];
  samples: string[];
  selectedFeatureId: string | null;
  onSelectFeature: (feature: OmicsFeature) => void;
}

export const ExpressionHeatmap: React.FC<ExpressionHeatmapProps> = ({
  features,
  samples,
  selectedFeatureId,
  onSelectFeature,
}) => {
  const [scaleMode, setScaleMode] = useState<'zscore' | 'raw'>('zscore');
  const [hoveredCell, setHoveredCell] = useState<{
    featureId: string;
    sample: string;
    rawVal: number;
    normVal: number;
  } | null>(null);

  const topFeatures = useMemo(() => {
    return [...features]
      .sort((a, b) => a.adjPValue - b.adjPValue)
      .slice(0, 14);
  }, [features]);

  const globalRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const f of topFeatures) {
      for (const s of samples) {
        const v = f.values[s];
        if (typeof v === 'number') {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return min === Infinity ? { min: 0, max: 1 } : { min, max };
  }, [topFeatures, samples]);

  const computeNormalized = (feature: OmicsFeature, value: number): number => {
    const vals = samples
      .map((s) => feature.values[s])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return 0.5;

    if (scaleMode === 'raw') {
      const span = globalRange.max - globalRange.min || 1;
      return (value - globalRange.min) / span;
    }

    // Row-wise Z-score mapped from [-2, +2] into [0, 1]
    const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;
    const variance =
      vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance) || 1;
    const z = (value - mean) / std;
    return Math.max(0, Math.min(1, (z + 2) / 4));
  };

  if (samples.length === 0 || topFeatures.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col justify-center items-center min-h-[340px] text-center">
        <h3 className="text-sm font-semibold text-zinc-900">Sample Expression Heatmap</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          No numeric sample intensity columns detected in this dataset. Upload a CSV/TSV with replicate columns to render the matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Top Differential Expression Matrix
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Top {topFeatures.length} features ranked by adjusted p-value
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 rounded-md">
          <button
            type="button"
            onClick={() => setScaleMode('zscore')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              scaleMode === 'zscore'
                ? 'bg-white text-[#BE185D] shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Row Z-Score
          </button>
          <button
            type="button"
            onClick={() => setScaleMode('raw')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              scaleMode === 'raw'
                ? 'bg-white text-[#BE185D] shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Raw Intensity
          </button>
        </div>
      </div>

      {/* Heatmap Matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          {/* Column Headers */}
          <div
            className="grid gap-[2px] mb-1 items-end"
            style={{
              gridTemplateColumns: `96px repeat(${samples.length}, minmax(36px, 1fr))`,
            }}
          >
            <div className="text-[11px] font-medium text-zinc-400 pb-1">Feature</div>
            {samples.map((sample) => (
              <div
                key={sample}
                className="text-[10px] font-mono text-zinc-600 text-center pb-1 truncate"
                title={sample}
              >
                {sample}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-[2px]">
            {topFeatures.map((feature) => {
              const isSelected = feature.id === selectedFeatureId;
              return (
                <div
                  key={feature.id}
                  onClick={() => onSelectFeature(feature)}
                  className={`grid gap-[2px] items-center cursor-pointer rounded-xs transition-opacity ${
                    isSelected ? 'ring-1 ring-zinc-900' : ''
                  }`}
                  style={{
                    gridTemplateColumns: `96px repeat(${samples.length}, minmax(36px, 1fr))`,
                  }}
                >
                  <div
                    className={`text-[11px] font-mono pr-2 truncate ${
                      isSelected ? 'font-semibold text-[#BE185D]' : 'text-zinc-800'
                    }`}
                    title={feature.id}
                  >
                    {feature.id}
                  </div>
                  {samples.map((sample) => {
                    const val = feature.values[sample];
                    const hasVal = typeof val === 'number';
                    const norm = hasVal ? computeNormalized(feature, val) : 0;
                    const bg = hasVal ? getGrayToMagentaColor(norm) : '#FAFAFB';

                    return (
                      <div
                        key={sample}
                        onMouseEnter={() => {
                          if (hasVal) {
                            setHoveredCell({
                              featureId: feature.id,
                              sample,
                              rawVal: val,
                              normVal: norm,
                            });
                          }
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className="h-5 rounded-[2px] transition-transform hover:scale-[1.03]"
                        style={{ backgroundColor: bg }}
                        aria-label={`${feature.id} ${sample}: ${hasVal ? val.toFixed(2) : 'N/A'}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Color Scale Legend + Hover Telemetry */}
      <div className="mt-4 pt-2.5 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono tabular-nums">
          <span>{scaleMode === 'zscore' ? '−2.0' : globalRange.min.toFixed(1)}</span>
          <div
            className="w-28 h-2.5 rounded-xs border border-zinc-200"
            style={{
              background:
                'linear-gradient(90deg, #F4F4F5 0%, #A1A1AA 35%, #D946EF 65%, #DB2777 85%, #831843 100%)',
            }}
            aria-label="Gray to Magenta expression intensity scale"
          />
          <span>{scaleMode === 'zscore' ? '+2.0' : globalRange.max.toFixed(1)}</span>
        </div>

        <div className="text-xs font-mono tabular-nums text-zinc-600">
          {hoveredCell ? (
            <span>
              <strong className="text-zinc-900">{hoveredCell.featureId}</strong> ·{' '}
              {hoveredCell.sample}:{' '}
              <strong className="text-[#BE185D]">{hoveredCell.rawVal.toFixed(2)}</strong>
            </span>
          ) : (
            <span className="text-zinc-400 font-sans">Hover cell to read intensity</span>
          )}
        </div>
      </div>
    </div>
  );
};
