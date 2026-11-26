import React, { useMemo, useState } from 'react';
import { Download, Menu, X } from 'lucide-react';
import { SAMPLE_DATASETS } from './data/sampleDatasets';
import {
  DashboardView,
  OmicsDataset,
  OmicsFeature,
  OmicsThresholds,
} from './types/omics';
import {
  buildCsvFromDataset,
  classifyFeature,
  parseUploadedOmicsFile,
  triggerFileDownload,
} from './utils/omicsParser';
import { Sidebar } from './components/Sidebar';
import { VolcanoPlot } from './components/VolcanoPlot';
import { ExpressionHeatmap } from './components/ExpressionHeatmap';
import { PathwayDistribution } from './components/PathwayDistribution';
import { FeatureTable } from './components/FeatureTable';
import { RestApiPanel } from './components/RestApiPanel';

const DEFAULT_THRESHOLDS: OmicsThresholds = {
  fcThreshold: 1.0,
  pThreshold: 0.05,
  searchQuery: '',
  regulationFilter: 'all',
};

export function App() {
  const [datasets, setDatasets] = useState<OmicsDataset[]>(SAMPLE_DATASETS);
  const [activeDatasetId, setActiveDatasetId] = useState<string>(SAMPLE_DATASETS[0].id);
  const [thresholds, setThresholds] = useState<OmicsThresholds>(DEFAULT_THRESHOLDS);
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    SAMPLE_DATASETS[0].features[0].id
  );
  const [activePathwayFilter, setActivePathwayFilter] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('http://localhost:8000');
  const [apiStatusMessage, setApiStatusMessage] = useState<string | null>(null);
  const [isApiLoading, setIsApiLoading] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? datasets[0],
    [datasets, activeDatasetId]
  );

  const filteredFeatures = useMemo(() => {
    const query = thresholds.searchQuery.trim().toLowerCase();
    return activeDataset.features.filter((f) => {
      if (activePathwayFilter && f.pathway !== activePathwayFilter) {
        return false;
      }
      if (!query) return true;
      return (
        f.id.toLowerCase().includes(query) ||
        f.pathway.toLowerCase().includes(query) ||
        (f.description?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [activeDataset, thresholds.searchQuery, activePathwayFilter]);

  const metrics = useMemo(() => {
    let up = 0;
    let down = 0;
    let maxNegLogP = 0;

    for (const f of filteredFeatures) {
      const status = classifyFeature(f, thresholds.fcThreshold, thresholds.pThreshold);
      if (status === 'upregulated') up++;
      else if (status === 'downregulated') down++;
      const negLogP = -Math.log10(Math.max(f.adjPValue, 1e-16));
      if (negLogP > maxNegLogP) maxNegLogP = negLogP;
    }

    const total = filteredFeatures.length;
    const sigTotal = up + down;
    const sigPct = total > 0 ? ((sigTotal / total) * 100).toFixed(1) : '0.0';

    return { total, up, down, sigPct, maxNegLogP };
  }, [filteredFeatures, thresholds.fcThreshold, thresholds.pThreshold]);

  const selectedFeature = useMemo(
    () =>
      activeDataset.features.find((f) => f.id === selectedFeatureId) ?? null,
    [activeDataset, selectedFeatureId]
  );

  const handleSelectDataset = (id: string) => {
    setActiveDatasetId(id);
    setActivePathwayFilter(null);
    setUploadError(null);
    const ds = datasets.find((d) => d.id === id);
    setSelectedFeatureId(ds?.features[0]?.id ?? null);
  };

  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = parseUploadedOmicsFile(file.name, text);
      setDatasets((prev) => [parsed, ...prev]);
      setActiveDatasetId(parsed.id);
      setActivePathwayFilter(null);
      setSelectedFeatureId(parsed.features[0]?.id ?? null);
      setActiveView('overview');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse uploaded file.');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = buildCsvFromDataset(SAMPLE_DATASETS[0], SAMPLE_DATASETS[0].features.slice(0, 15));
    triggerFileDownload('omics_sample_template.csv', csv);
  };

  const handleExportCsv = () => {
    const csv = buildCsvFromDataset(activeDataset, filteredFeatures);
    triggerFileDownload(`${activeDataset.id}_filtered.csv`, csv);
  };

  const handleFetchFromApi = async () => {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    setIsApiLoading(true);
    setApiStatusMessage(null);
    try {
      const res = await fetch(`${cleanBase}/api/datasets/rnaseq-brca`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.features) || data.features.length === 0) {
        throw new Error('Empty dataset returned from API');
      }
      const remoteDataset: OmicsDataset = {
        id: `api-${Date.now()}`,
        name: `${data.name || 'Python API Dataset'}`,
        omicsType: 'Python REST API',
        conditionA: 'Group A',
        conditionB: 'Group B',
        samples: data.samples ?? [],
        features: data.features,
      };
      setDatasets((prev) => [remoteDataset, ...prev]);
      setActiveDatasetId(remoteDataset.id);
      setSelectedFeatureId(remoteDataset.features[0]?.id ?? null);
      setApiStatusMessage(`Loaded ${remoteDataset.features.length} features from Python REST API.`);
    } catch (err) {
      setApiStatusMessage(
        `Could not reach ${cleanBase}. Run "python3 api/omics_api.py" locally or test in the REST API tab.`
      );
    } finally {
      setIsApiLoading(false);
    }
  };

  const handleSelectFeature = (feature: OmicsFeature) => {
    setSelectedFeatureId(feature.id);
  };

  return (
    <div className="min-h-screen flex bg-[#F5F5F7] text-zinc-900">
      <Sidebar
        datasets={datasets}
        activeDatasetId={activeDataset.id}
        onSelectDataset={handleSelectDataset}
        onUploadFile={handleUploadFile}
        uploadError={uploadError}
        onDownloadTemplate={handleDownloadTemplate}
        thresholds={thresholds}
        onUpdateThresholds={(next) => setThresholds((prev) => ({ ...prev, ...next }))}
        onResetThresholds={() => {
          setThresholds(DEFAULT_THRESHOLDS);
          setActivePathwayFilter(null);
        }}
        apiBaseUrl={apiBaseUrl}
        onApiBaseUrlChange={setApiBaseUrl}
        onFetchFromApi={handleFetchFromApi}
        apiStatusMessage={apiStatusMessage}
        isApiLoading={isApiLoading}
        onOpenApiView={() => {
          setActiveView('api');
          setMobileSidebarOpen(false);
        }}
        activeView={activeView}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Display Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Top Display Header */}
        <header className="bg-white border-b border-zinc-200 px-6 py-3.5 sticky top-0 z-20">
          <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded border border-zinc-200 text-zinc-700 hover:text-zinc-900"
                aria-label="Open controls sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-zinc-900 truncate">
                  {activeDataset.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-0.5 tabular-nums">
                  <span>{activeDataset.omicsType}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeDataset.conditionA} vs. {activeDataset.conditionB}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeDataset.features.length} features</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeDataset.samples.length} samples</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <nav
                aria-label="Dashboard views"
                className="flex items-center gap-1 p-1 bg-zinc-100 rounded-md"
              >
                {(
                  [
                    { id: 'overview', label: 'Overview' },
                    { id: 'matrix', label: 'Data Table' },
                    { id: 'api', label: 'REST API' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveView(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      activeView === tab.id
                        ? 'bg-white text-[#BE185D] shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#BE185D] hover:bg-[#9D174D] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 px-6 py-6">
          <div className="max-w-[1360px] mx-auto space-y-5">
            {/* Active Filter Notice if pathway selected */}
            {activePathwayFilter && (
              <div className="bg-white border border-zinc-200 rounded-md px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="text-zinc-700">
                  Filtered by pathway:{' '}
                  <strong className="text-[#BE185D]">{activePathwayFilter}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActivePathwayFilter(null)}
                  className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            )}

            {/* 4-Column Summary Strip */}
            <section
              aria-label="Dataset summary metrics"
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3.5">
                <div className="text-xs text-zinc-500 font-medium">Features Evaluated</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-zinc-900">
                  {metrics.total}
                </div>
                <div className="mt-1 text-xs text-zinc-500 tabular-nums">
                  {metrics.sigPct}% pass significance cutoff
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3.5">
                <div className="text-xs text-zinc-500 font-medium">Upregulated Hits</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#BE185D]">
                  {metrics.up}
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono tabular-nums">
                  log2FC ≥ +{thresholds.fcThreshold.toFixed(1)}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3.5">
                <div className="text-xs text-zinc-500 font-medium">Downregulated Hits</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-zinc-800">
                  {metrics.down}
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono tabular-nums">
                  log2FC ≤ −{thresholds.fcThreshold.toFixed(1)}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3.5">
                <div className="text-xs text-zinc-500 font-medium">Selected Feature</div>
                <div className="mt-1 text-xl font-bold font-mono text-zinc-900 truncate">
                  {selectedFeature ? selectedFeature.id : '—'}
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono tabular-nums truncate">
                  {selectedFeature
                    ? `log2FC ${selectedFeature.log2FoldChange >= 0 ? '+' : ''}${selectedFeature.log2FoldChange.toFixed(2)} · ${selectedFeature.pathway}`
                    : 'Click any plot point or row'}
                </div>
              </div>
            </section>

            {/* View Switcher Content */}
            {activeView === 'overview' && (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
                  <div className="xl:col-span-7 flex flex-col">
                    <VolcanoPlot
                      features={filteredFeatures}
                      fcThreshold={thresholds.fcThreshold}
                      pThreshold={thresholds.pThreshold}
                      selectedFeatureId={selectedFeatureId}
                      onSelectFeature={handleSelectFeature}
                    />
                  </div>
                  <div className="xl:col-span-5 flex flex-col">
                    <ExpressionHeatmap
                      features={filteredFeatures}
                      samples={activeDataset.samples}
                      selectedFeatureId={selectedFeatureId}
                      onSelectFeature={handleSelectFeature}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                  <div className="xl:col-span-4">
                    <PathwayDistribution
                      features={activeDataset.features}
                      fcThreshold={thresholds.fcThreshold}
                      pThreshold={thresholds.pThreshold}
                      activePathwayFilter={activePathwayFilter}
                      onSelectPathway={setActivePathwayFilter}
                    />
                  </div>
                  <div className="xl:col-span-8">
                    <FeatureTable
                      features={filteredFeatures}
                      fcThreshold={thresholds.fcThreshold}
                      pThreshold={thresholds.pThreshold}
                      regulationFilter={thresholds.regulationFilter}
                      onChangeRegulationFilter={(regulationFilter) =>
                        setThresholds((prev) => ({ ...prev, regulationFilter }))
                      }
                      selectedFeatureId={selectedFeatureId}
                      onSelectFeature={handleSelectFeature}
                      compact
                    />
                  </div>
                </div>
              </>
            )}

            {activeView === 'matrix' && (
              <FeatureTable
                features={filteredFeatures}
                fcThreshold={thresholds.fcThreshold}
                pThreshold={thresholds.pThreshold}
                regulationFilter={thresholds.regulationFilter}
                onChangeRegulationFilter={(regulationFilter) =>
                  setThresholds((prev) => ({ ...prev, regulationFilter }))
                }
                selectedFeatureId={selectedFeatureId}
                onSelectFeature={handleSelectFeature}
              />
            )}

            {activeView === 'api' && (
              <RestApiPanel
                apiBaseUrl={apiBaseUrl}
                onApiBaseUrlChange={setApiBaseUrl}
                activeDataset={activeDataset}
                fcThreshold={thresholds.fcThreshold}
                pThreshold={thresholds.pThreshold}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
