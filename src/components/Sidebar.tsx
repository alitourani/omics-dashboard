import React, { useRef, useState } from 'react';
import { Upload, Download, Search, Server, RotateCcw, X } from 'lucide-react';
import { OmicsDataset, OmicsThresholds, DashboardView } from '../types/omics';

interface SidebarProps {
  datasets: OmicsDataset[];
  activeDatasetId: string;
  onSelectDataset: (id: string) => void;
  onUploadFile: (file: File) => void;
  uploadError: string | null;
  onDownloadTemplate: () => void;
  thresholds: OmicsThresholds;
  onUpdateThresholds: (next: Partial<OmicsThresholds>) => void;
  onResetThresholds: () => void;
  apiBaseUrl: string;
  onApiBaseUrlChange: (url: string) => void;
  onFetchFromApi: () => void;
  apiStatusMessage: string | null;
  isApiLoading: boolean;
  onOpenApiView: () => void;
  activeView: DashboardView;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  datasets,
  activeDatasetId,
  onSelectDataset,
  onUploadFile,
  uploadError,
  onDownloadTemplate,
  thresholds,
  onUpdateThresholds,
  onResetThresholds,
  apiBaseUrl,
  onApiBaseUrlChange,
  onFetchFromApi,
  apiStatusMessage,
  isApiLoading,
  onOpenApiView,
  mobileOpen,
  onCloseMobile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-zinc-200 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-6 w-6 rounded shrink-0"
            style={{
              background: 'linear-gradient(135deg, #52525B 0%, #DB2777 65%, #831843 100%)',
            }}
            aria-hidden="true"
          />
          <span className="text-base font-bold tracking-tight text-zinc-900 whitespace-nowrap truncate">
            Omics Data Vizualization
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-zinc-500 hover:text-zinc-900 rounded focus-visible:outline-2 focus-visible:outline-[#BE185D]"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Section 1: Data Source */}
        <section aria-labelledby="sidebar-data-source">
          <h2
            id="sidebar-data-source"
            className="text-xs font-medium tracking-wide text-zinc-500 uppercase mb-2.5"
          >
            Data Source
          </h2>
          <label htmlFor="dataset-select" className="block text-xs text-zinc-700 font-medium mb-1.5">
            Active Dataset
          </label>
          <select
            id="dataset-select"
            value={activeDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#BE185D] focus:outline-none transition-colors"
          >
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-3 rounded-md border border-dashed p-3.5 text-center transition-colors ${isDragging
                ? 'border-[#DB2777] bg-[#FDF2F8]'
                : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.json"
              onChange={handleFileChange}
              className="hidden"
              id="omics-file-upload"
            />
            <Upload className="w-4 h-4 mx-auto text-zinc-500 mb-1.5" />
            <p className="text-xs text-zinc-700 font-medium">Upload CSV, TSV, or JSON</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Requires id, log2FC, and p-value columns
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2.5 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-zinc-800 bg-white border border-zinc-300 rounded hover:border-[#DB2777] hover:text-[#BE185D] transition-colors whitespace-nowrap"
            >
              Browse File
            </button>
          </div>

          {uploadError && (
            <p role="alert" className="mt-2 text-xs text-[#BE185D] font-medium">
              {uploadError}
            </p>
          )}

          <button
            type="button"
            onClick={onDownloadTemplate}
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-[#BE185D] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download template CSV</span>
          </button>
        </section>

        <hr className="border-zinc-200" />

        {/* Section 2: Visualization Thresholds */}
        <section aria-labelledby="sidebar-thresholds">
          <div className="flex items-center justify-between mb-3">
            <h2
              id="sidebar-thresholds"
              className="text-xs font-medium tracking-wide text-zinc-500 uppercase"
            >
              Significance Cutoffs
            </h2>
            <button
              type="button"
              onClick={onResetThresholds}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
              title="Reset thresholds"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Fold Change Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="fc-slider" className="text-zinc-700 font-medium">
                |log2 Fold Change|
              </label>
              <span className="font-mono tabular-nums font-medium text-[#BE185D]">
                ≥ {thresholds.fcThreshold.toFixed(1)}
              </span>
            </div>
            <input
              id="fc-slider"
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={thresholds.fcThreshold}
              onChange={(e) => onUpdateThresholds({ fcThreshold: parseFloat(e.target.value) })}
              className="w-full accent-[#DB2777] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-zinc-400 mt-0.5">
              <span>0.5</span>
              <span>1.5</span>
              <span>3.0</span>
            </div>
          </div>

          {/* p-value Cutoff */}
          <div className="mb-4">
            <span className="block text-xs text-zinc-700 font-medium mb-1.5">
              Adjusted p-value
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 rounded-md">
              {[0.05, 0.01, 0.001].map((p) => {
                const isActive = thresholds.pThreshold === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdateThresholds({ pThreshold: p })}
                    className={`py-1.5 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap ${isActive
                        ? 'bg-white text-[#BE185D] font-medium shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                  >
                    &lt; {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature Search */}
          <div>
            <label htmlFor="feature-search" className="block text-xs text-zinc-700 font-medium mb-1.5">
              Filter Feature or Pathway
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="feature-search"
                type="text"
                value={thresholds.searchQuery}
                onChange={(e) => onUpdateThresholds({ searchQuery: e.target.value })}
                placeholder="e.g. ERBB2, Cell Cycle"
                className="w-full rounded-md border border-zinc-300 bg-white pl-8 pr-7 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#BE185D] focus:outline-none"
              />
              {thresholds.searchQuery && (
                <button
                  type="button"
                  onClick={() => onUpdateThresholds({ searchQuery: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        <hr className="border-zinc-200" />

        {/* Section 3: Python REST API */}
        <section aria-labelledby="sidebar-rest-api">
          <div className="flex items-center justify-between mb-2">
            <h2
              id="sidebar-rest-api"
              className="text-xs font-medium tracking-wide text-zinc-500 uppercase"
            >
              Python REST API
            </h2>
            <button
              type="button"
              onClick={onOpenApiView}
              className="text-xs font-medium text-[#BE185D] hover:underline whitespace-nowrap"
            >
              Endpoints
            </button>
          </div>

          <label htmlFor="api-base-url" className="block text-xs text-zinc-700 font-medium mb-1.5">
            Backend Base URL
          </label>
          <input
            id="api-base-url"
            type="url"
            value={apiBaseUrl}
            onChange={(e) => onApiBaseUrlChange(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-mono text-zinc-800 focus:border-[#BE185D] focus:outline-none"
          />

          <button
            type="button"
            onClick={onFetchFromApi}
            disabled={isApiLoading}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-[#BE185D] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Server className="w-3.5 h-3.5" />
            <span>{isApiLoading ? 'Connecting...' : 'Load via REST API'}</span>
          </button>

          {apiStatusMessage && (
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              {apiStatusMessage}
            </p>
          )}
        </section>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[276px] shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-zinc-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-[280px] max-w-[85vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
