import { OmicsDataset, OmicsFeature, RegulationStatus } from '../types/omics';

export function classifyFeature(
  feature: OmicsFeature,
  fcThreshold: number,
  pThreshold: number
): RegulationStatus {
  const sigP = feature.adjPValue <= pThreshold;
  if (!sigP) return 'unchanged';
  if (feature.log2FoldChange >= fcThreshold) return 'upregulated';
  if (feature.log2FoldChange <= -fcThreshold) return 'downregulated';
  return 'unchanged';
}

/**
 * Interpolates a normalized [0, 1] value across a calibrated Gray-to-Magenta ramp:
 * 0.0 -> #F4F4F5 (Light Neutral Gray)
 * 0.35 -> #A1A1AA (Mid Cool Gray)
 * 0.65 -> #D946EF (Orchid / Soft Magenta)
 * 0.85 -> #DB2777 (Vibrant Magenta)
 * 1.0 -> #831843 (Deep Magenta)
 */
export function getGrayToMagentaColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [244, 244, 245]],
    [0.35, [161, 161, 170]],
    [0.65, [217, 70, 239]],
    [0.85, [219, 39, 119]],
    [1.0, [131, 24, 67]],
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const localT = (clamped - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * localT);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * localT);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * localT);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return 'rgb(131, 24, 67)';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseUploadedOmicsFile(
  filename: string,
  content: string
): OmicsDataset {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('The uploaded file is empty.');
  }

  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.json')) {
    const parsed = JSON.parse(trimmed);
    const rawFeatures = Array.isArray(parsed) ? parsed : parsed.features;
    if (!Array.isArray(rawFeatures) || rawFeatures.length === 0) {
      throw new Error('JSON must be an array of features or contain a non-empty "features" array.');
    }

    const inferredSamples = new Set<string>();
    const features: OmicsFeature[] = rawFeatures.map((row: Record<string, unknown>, idx: number) => {
      const rawValues =
        row.values && typeof row.values === 'object'
          ? (row.values as Record<string, number>)
          : {};
      Object.keys(rawValues).forEach((s) => inferredSamples.add(s));

      const log2FoldChange = Number(row.log2FoldChange ?? row.log2FC ?? row.fc ?? 0);
      const pValue = Number(row.pValue ?? row.pvalue ?? row.pval ?? 0.05);
      const adjPValue = Number(row.adjPValue ?? row.padj ?? row.fdr ?? pValue);
      const baseMean = Number(row.baseMean ?? row.mean ?? 100);

      return {
        id: String(row.id ?? row.gene ?? row.feature ?? `Feature_${idx + 1}`),
        description: row.description ? String(row.description) : undefined,
        pathway: String(row.pathway ?? 'Unassigned'),
        chromosome: row.chromosome ? String(row.chromosome) : undefined,
        log2FoldChange: Number.isFinite(log2FoldChange) ? log2FoldChange : 0,
        pValue: Number.isFinite(pValue) && pValue > 0 ? pValue : 1e-12,
        adjPValue: Number.isFinite(adjPValue) && adjPValue > 0 ? adjPValue : 1e-12,
        baseMean: Number.isFinite(baseMean) ? baseMean : 0,
        values: rawValues,
      };
    });

    const samples = Array.isArray(parsed.samples)
      ? (parsed.samples as string[])
      : Array.from(inferredSamples);

    return {
      id: `upload-${Date.now()}`,
      name: filename.replace(/\.(json)$/i, ''),
      omicsType: 'Custom Upload',
      conditionA: 'Group A',
      conditionB: 'Group B',
      samples,
      features,
    };
  }

  // CSV or TSV parsing
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('File must include a header row and at least one data row.');
  }

  const delimiter = lowerName.endsWith('.tsv') || lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter);
  const normHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findCol = (candidates: string[]) =>
    normHeaders.findIndex((h) => candidates.includes(h));

  const idIdx = findCol(['id', 'gene', 'genesymbol', 'symbol', 'feature', 'protein', 'metabolite', 'name']);
  const fcIdx = findCol(['log2foldchange', 'log2fc', 'lfc', 'foldchange', 'logfc']);
  const pIdx = findCol(['pvalue', 'pval', 'p']);
  const padjIdx = findCol(['adjpvalue', 'padj', 'fdr', 'qvalue', 'adjp']);
  const meanIdx = findCol(['basemean', 'mean', 'abundance', 'intensity', 'expression']);
  const pathwayIdx = findCol(['pathway', 'category', 'process', 'group']);
  const descIdx = findCol(['description', 'desc', 'fullname']);

  if (fcIdx === -1) {
    throw new Error(
      'Could not detect a fold-change column (expected e.g. "log2FoldChange", "log2FC", or "logFC").'
    );
  }

  const reservedIndices = new Set(
    [idIdx, fcIdx, pIdx, padjIdx, meanIdx, pathwayIdx, descIdx].filter((i) => i >= 0)
  );
  const sampleIndices = headers
    .map((name, idx) => ({ name, idx }))
    .filter(({ idx }) => !reservedIndices.has(idx));

  const features: OmicsFeature[] = [];
  const validSampleColumns = new Set<string>();

  for (let r = 1; r < lines.length; r++) {
    const cells = splitDelimitedLine(lines[r], delimiter);
    if (cells.length === 1 && !cells[0]) continue;

    const id = idIdx >= 0 && cells[idIdx] ? cells[idIdx] : `Feature_${r}`;
    const fc = parseFloat(cells[fcIdx]);
    if (!Number.isFinite(fc)) continue;

    const rawP = pIdx >= 0 ? parseFloat(cells[pIdx]) : 0.05;
    const rawPadj = padjIdx >= 0 ? parseFloat(cells[padjIdx]) : rawP;
    const pValue = Number.isFinite(rawP) && rawP > 0 ? rawP : 1e-12;
    const adjPValue = Number.isFinite(rawPadj) && rawPadj > 0 ? rawPadj : pValue;
    const baseMean = meanIdx >= 0 && Number.isFinite(parseFloat(cells[meanIdx]))
      ? parseFloat(cells[meanIdx])
      : 1000;

    const values: Record<string, number> = {};
    for (const s of sampleIndices) {
      const val = parseFloat(cells[s.idx]);
      if (Number.isFinite(val)) {
        values[s.name] = val;
        validSampleColumns.add(s.name);
      }
    }

    features.push({
      id,
      description: descIdx >= 0 ? cells[descIdx] : undefined,
      pathway: pathwayIdx >= 0 && cells[pathwayIdx] ? cells[pathwayIdx] : 'Custom',
      log2FoldChange: fc,
      pValue,
      adjPValue,
      baseMean,
      values,
    });
  }

  if (features.length === 0) {
    throw new Error('No valid numeric Omics rows could be parsed from the file.');
  }

  return {
    id: `upload-${Date.now()}`,
    name: filename.replace(/\.(csv|tsv|txt)$/i, ''),
    omicsType: 'Custom Upload',
    conditionA: 'Group A',
    conditionB: 'Group B',
    samples: Array.from(validSampleColumns),
    features,
  };
}

export function buildCsvFromDataset(dataset: OmicsDataset, features: OmicsFeature[]): string {
  const sampleCols = dataset.samples;
  const header = [
    'id',
    'pathway',
    'log2FoldChange',
    'pValue',
    'adjPValue',
    'baseMean',
    ...sampleCols,
  ].join(',');

  const rows = features.map((f) => {
    const base = [
      `"${f.id.replace(/"/g, '""')}"`,
      `"${f.pathway.replace(/"/g, '""')}"`,
      f.log2FoldChange.toFixed(4),
      f.pValue.toExponential(3),
      f.adjPValue.toExponential(3),
      f.baseMean.toFixed(2),
    ];
    const sampleVals = sampleCols.map((s) =>
      f.values[s] !== undefined ? f.values[s].toFixed(3) : ''
    );
    return [...base, ...sampleVals].join(',');
  });

  return [header, ...rows].join('\n');
}

export function triggerFileDownload(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
