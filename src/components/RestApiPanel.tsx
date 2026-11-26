import React, { useState } from 'react';
import { Play, Copy, Check } from 'lucide-react';
import { OmicsDataset } from '../types/omics';

interface RestApiPanelProps {
  apiBaseUrl: string;
  onApiBaseUrlChange: (url: string) => void;
  activeDataset: OmicsDataset;
  fcThreshold: number;
  pThreshold: number;
}

const PYTHON_SNIPPET = `from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class OmicsHandler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path == "/api/health":
            self._send(200, {"status": "ok", "service": "omics-rest-api"})
        elif self.path == "/api/datasets":
            self._send(200, {"datasets": [{"id": "rnaseq-brca", "name": "Breast Carcinoma RNA-Seq"}]})
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/api/analyze":
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))
            features = data.get("features", [])
            fc = float(data.get("fcThreshold", 1.0))
            p = float(data.get("pThreshold", 0.05))
            up = [f["id"] for f in features if f["adjPValue"] <= p and f["log2FoldChange"] >= fc]
            down = [f["id"] for f in features if f["adjPValue"] <= p and f["log2FoldChange"] <= -fc]
            self._send(200, {"upregulated": len(up), "downregulated": len(down), "topUp": up[:5]})

HTTPServer(("0.0.0.0", 8000), OmicsHandler).serve_forever()`;

export const RestApiPanel: React.FC<RestApiPanelProps> = ({
  apiBaseUrl,
  onApiBaseUrlChange,
  activeDataset,
  fcThreshold,
  pThreshold,
}) => {
  const [responseOutput, setResponseOutput] = useState<string>(
    'Click any endpoint button to issue a live HTTP request to your Python backend.'
  );
  const [responseMeta, setResponseMeta] = useState<string | null>(null);
  const [loadingEndpoint, setLoadingEndpoint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const testEndpoint = async (method: 'GET' | 'POST', path: string) => {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}${path}`;
    setLoadingEndpoint(path);
    const start = performance.now();

    try {
      const res = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body:
          method === 'POST'
            ? JSON.stringify({
                datasetId: activeDataset.id,
                fcThreshold,
                pThreshold,
                features: activeDataset.features,
              })
            : undefined,
      });

      const elapsed = Math.round(performance.now() - start);
      const text = await res.text();
      setResponseMeta(`${method} ${path} · HTTP ${res.status} · ${elapsed} ms`);
      try {
        setResponseOutput(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponseOutput(text);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResponseMeta(`${method} ${path} · Connection failed · ${elapsed} ms`);
      setResponseOutput(
        `Unable to reach ${url}.\n\nTo run the local Python REST server included in api/omics_api.py:\n  python3 api/omics_api.py\n\nError: ${
          err instanceof Error ? err.message : 'Network error'
        }`
      );
    } finally {
      setLoadingEndpoint(null);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(PYTHON_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* Left: Live Endpoint Tester */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-zinc-900">
          Simple REST API Tester
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5 mb-4">
          Designed for static GitHub Pages frontends calling lightweight Python REST endpoints with CORS enabled.
        </p>

        <label htmlFor="rest-url-input" className="block text-xs font-medium text-zinc-700 mb-1.5">
          Python API Base URL
        </label>
        <input
          id="rest-url-input"
          type="url"
          value={apiBaseUrl}
          onChange={(e) => onApiBaseUrlChange(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs font-mono text-zinc-800 focus:border-[#BE185D] focus:outline-none mb-4"
        />

        <div className="space-y-2.5 mb-4">
          {[
            {
              method: 'GET' as const,
              path: '/api/health',
              desc: 'Verify Python backend availability',
            },
            {
              method: 'GET' as const,
              path: '/api/datasets',
              desc: 'List available server-side Omics datasets',
            },
            {
              method: 'GET' as const,
              path: '/api/datasets/rnaseq-brca',
              desc: 'Fetch sample RNA-seq matrix JSON',
            },
            {
              method: 'POST' as const,
              path: '/api/analyze',
              desc: 'Send current dataset & cutoffs for Python summary',
            },
          ].map((ep) => (
            <div
              key={ep.path}
              className="flex items-center justify-between gap-3 border border-zinc-200 rounded-md px-3.5 py-2.5 bg-zinc-50/70"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span
                    className={`font-semibold ${
                      ep.method === 'POST' ? 'text-[#BE185D]' : 'text-zinc-800'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="text-zinc-900 truncate">{ep.path}</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">{ep.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => testEndpoint(ep.method, ep.path)}
                disabled={loadingEndpoint === ep.path}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-[#BE185D] rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>{loadingEndpoint === ep.path ? 'Running' : 'Send'}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-zinc-700">Response Payload</span>
            {responseMeta && (
              <span className="font-mono tabular-nums text-[11px] text-[#BE185D]">
                {responseMeta}
              </span>
            )}
          </div>
          <pre className="rounded-md bg-zinc-900 text-zinc-100 p-3.5 text-xs font-mono overflow-x-auto max-h-[240px] leading-relaxed">
            {responseOutput}
          </pre>
        </div>
      </div>

      {/* Right: Zero-Dependency Python Starter */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Minimal Python REST Backend
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Included at <code className="font-mono text-zinc-700">api/omics_api.py</code> · Zero external dependencies
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-300 rounded hover:border-[#DB2777] hover:text-[#BE185D] transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#BE185D]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Python'}</span>
          </button>
        </div>

        <pre className="flex-1 rounded-md bg-zinc-900 text-zinc-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
          {PYTHON_SNIPPET}
        </pre>
      </div>
    </div>
  );
};
