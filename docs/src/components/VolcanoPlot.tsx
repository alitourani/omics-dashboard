import React, { useMemo, useState } from 'react';
import { OmicsFeature } from '../types/omics';
import { classifyFeature } from '../utils/omicsParser';

interface VolcanoPlotProps {
  features: OmicsFeature[];
  fcThreshold: number;
  pThreshold: number;
  selectedFeatureId: string | null;
  onSelectFeature: (feature: OmicsFeature) => void;
}

export const VolcanoPlot: React.FC<VolcanoPlotProps> = ({
  features,
  fcThreshold,
  pThreshold,
  selectedFeatureId,
  onSelectFeature,
}) => {
  const [hoveredFeature, setHoveredFeature] = useState<OmicsFeature | null>(null);

  const width = 640;
  const height = 380;
  const pad = { top: 24, right: 24, bottom: 44, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { points, xMin, xMax, yMax, labeledIds } = useMemo(() => {
    if (features.length === 0) {
      return { points: [], xMin: -4, xMax: 4, yMax: 10, labeledIds: new Set<string>() };
    }

    const mapped = features.map((f) => {
      const negLogP = -Math.log10(Math.max(f.adjPValue, 1e-16));
      const status = classifyFeature(f, fcThreshold, pThreshold);
      return { feature: f, x: f.log2FoldChange, y: negLogP, status };
    });

    const maxAbsX = Math.max(
      2.5,
      fcThreshold + 0.8,
      ...mapped.map((p) => Math.abs(p.x))
    );
    const xBound = Math.ceil(maxAbsX * 1.08 * 2) / 2;
    const rawYMax = Math.max(
      -Math.log10(pThreshold) + 1.5,
      ...mapped.map((p) => p.y)
    );
    const yBound = Math.ceil(rawYMax * 1.1);

    // Pick top 8 most significant hits to label cleanly
    const sigSorted = [...mapped]
      .filter((p) => p.status !== 'unchanged')
      .sort((a, b) => b.y + Math.abs(b.x) - (a.y + Math.abs(a.x)))
      .slice(0, 8);

    return {
      points: mapped,
      xMin: -xBound,
      xMax: xBound,
      yMax: yBound,
      labeledIds: new Set(sigSorted.map((p) => p.feature.id)),
    };
  }, [features, fcThreshold, pThreshold]);

  const scaleX = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const scaleY = (y: number) => pad.top + plotH - (y / yMax) * plotH;

  const pCutoffY = scaleY(-Math.log10(pThreshold));
  const fcNegX = scaleX(-fcThreshold);
  const fcPosX = scaleX(fcThreshold);

  const xTicks = useMemo(() => {
    const step = xMax > 5 ? 2 : 1;
    const ticks: number[] = [];
    for (let v = -Math.floor(xMax); v <= Math.floor(xMax); v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [xMax]);

  const yTicks = useMemo(() => {
    const step = yMax > 10 ? 3 : 2;
    const ticks: number[] = [];
    for (let v = 0; v <= yMax; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [yMax]);

  const activePoint = hoveredFeature
    ? points.find((p) => p.feature.id === hoveredFeature.id)
    : selectedFeatureId
    ? points.find((p) => p.feature.id === selectedFeatureId)
    : null;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Differential Expression Volcano Plot
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            log2(Fold Change) vs. −log10(Adjusted p-value) · Click any point to inspect
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DB2777]" aria-hidden="true" />
            <span>Upregulated</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
            <span>Downregulated</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" aria-hidden="true" />
            <span>Unchanged</span>
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          role="img"
          aria-label="Volcano plot of Omics features"
        >
          {/* Plot background */}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="#FAFAFB"
            stroke="#E4E4E7"
            strokeWidth={1}
          />

          {/* Grid lines */}
          {xTicks.map((tick) => {
            const x = scaleX(tick);
            return (
              <g key={`xtick-${tick}`}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={pad.top + plotH}
                  stroke={tick === 0 ? '#D4D4D8' : '#F4F4F5'}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={pad.top + plotH + 16}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[10px] font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {yTicks.map((tick) => {
            const y = scaleY(tick);
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  stroke="#F4F4F5"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 text-[10px] font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Threshold lines */}
          {pCutoffY >= pad.top && pCutoffY <= pad.top + plotH && (
            <line
              x1={pad.left}
              y1={pCutoffY}
              x2={pad.left + plotW}
              y2={pCutoffY}
              stroke="#BE185D"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.55}
            />
          )}
          <line
            x1={fcNegX}
            y1={pad.top}
            x2={fcNegX}
            y2={pad.top + plotH}
            stroke="#71717A"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <line
            x1={fcPosX}
            y1={pad.top}
            x2={fcPosX}
            y2={pad.top + plotH}
            stroke="#BE185D"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.55}
          />

          {/* Interactive Crosshair for hovered/selected point */}
          {activePoint && (
            <g pointerEvents="none">
              <line
                x1={scaleX(activePoint.x)}
                y1={pad.top}
                x2={scaleX(activePoint.x)}
                y2={pad.top + plotH}
                stroke="#BE185D"
                strokeWidth={0.8}
                opacity={0.35}
              />
              <line
                x1={pad.left}
                y1={scaleY(activePoint.y)}
                x2={pad.left + plotW}
                y2={scaleY(activePoint.y)}
                stroke="#BE185D"
                strokeWidth={0.8}
                opacity={0.35}
              />
            </g>
          )}

          {/* Data Points */}
          {points.map((pt) => {
            const cx = scaleX(pt.x);
            const cy = scaleY(pt.y);
            const isSelected = pt.feature.id === selectedFeatureId;
            const isHovered = pt.feature.id === hoveredFeature?.id;

            let fill = '#D4D4D8';
            let opacity = 0.75;
            if (pt.status === 'upregulated') {
              fill = pt.y > 6 ? '#9D174D' : '#DB2777';
              opacity = 0.92;
            } else if (pt.status === 'downregulated') {
              fill = '#3F3F46';
              opacity = 0.88;
            }

            return (
              <g key={pt.feature.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 6 : pt.status === 'unchanged' ? 3.5 : 4.5}
                  fill={fill}
                  fillOpacity={opacity}
                  stroke={isSelected || isHovered ? '#18181B' : '#FFFFFF'}
                  strokeWidth={isSelected || isHovered ? 1.75 : 0.75}
                  className="transition-all duration-100 cursor-pointer"
                  onMouseEnter={() => setHoveredFeature(pt.feature)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  onClick={() => onSelectFeature(pt.feature)}
                />
                {(labeledIds.has(pt.feature.id) || isSelected || isHovered) && (
                  <text
                    x={cx + 7}
                    y={cy + 3}
                    className={`text-[10px] font-mono pointer-events-none ${
                      isSelected || isHovered
                        ? 'fill-zinc-950 font-medium'
                        : pt.status === 'upregulated'
                        ? 'fill-[#9D174D]'
                        : 'fill-zinc-700'
                    }`}
                  >
                    {pt.feature.id}
                  </text>
                )}
              </g>
            );
          })}

          {/* Axis Labels */}
          <text
            x={pad.left + plotW / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-zinc-600 text-[11px] font-medium"
          >
            log2(Fold Change)
          </text>
          <text
            x={15}
            y={pad.top + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 15 ${pad.top + plotH / 2})`}
            className="fill-zinc-600 text-[11px] font-medium"
          >
            −log10(Adj. p-value)
          </text>
        </svg>

        {/* Compact Coordinate Readout Strip */}
        <div className="mt-2 pt-2.5 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums text-zinc-600 min-h-[28px]">
          {activePoint ? (
            <>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-900">{activePoint.feature.id}</span>
                <span className="text-zinc-400">·</span>
                <span>{activePoint.feature.pathway}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  log2FC:{' '}
                  <strong
                    className={
                      activePoint.x >= 0 ? 'text-[#BE185D]' : 'text-zinc-900'
                    }
                  >
                    {activePoint.x >= 0 ? '+' : ''}
                    {activePoint.x.toFixed(2)}
                  </strong>
                </span>
                <span>adj.p: {activePoint.feature.adjPValue.toExponential(2)}</span>
              </div>
            </>
          ) : (
            <span className="text-zinc-400 font-sans">
              Hover or click a point to inspect fold-change and adjusted significance
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
