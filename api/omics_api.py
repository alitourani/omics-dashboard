#!/usr/bin/env python3

"""
Minimal Python REST API for OmicsDataViz.
Uses only the Python 3 standard library (no pip dependencies required).

Run locally:
    python3 api/omics_api.py

Default server address: http://localhost:8000
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import math
import os
from urllib.parse import urlparse

SAMPLE_DATASETS = {
    "rnaseq-brca": {
        "id": "rnaseq-brca",
        "name": "Breast Carcinoma RNA-Seq (Tumor vs. Control)",
        "omicsType": "Transcriptomics",
        "samples": ["Ctrl_1", "Ctrl_2", "Ctrl_3", "Tumor_1", "Tumor_2", "Tumor_3"],
        "features": [
            {
                "id": "ERBB2",
                "pathway": "RTK Signaling",
                "log2FoldChange": 3.42,
                "pValue": 1.2e-14,
                "adjPValue": 4.8e-13,
                "baseMean": 18420.5,
                "values": {
                    "Ctrl_1": 6.1,
                    "Ctrl_2": 6.4,
                    "Ctrl_3": 5.9,
                    "Tumor_1": 9.6,
                    "Tumor_2": 9.8,
                    "Tumor_3": 9.4,
                },
            },
            {
                "id": "MKI67",
                "pathway": "Cell Cycle",
                "log2FoldChange": 2.85,
                "pValue": 3.5e-11,
                "adjPValue": 6.2e-10,
                "baseMean": 9310.2,
                "values": {
                    "Ctrl_1": 4.8,
                    "Ctrl_2": 5.1,
                    "Ctrl_3": 4.7,
                    "Tumor_1": 7.7,
                    "Tumor_2": 7.9,
                    "Tumor_3": 7.5,
                },
            },
            {
                "id": "MYC",
                "pathway": "Transcription",
                "log2FoldChange": 2.18,
                "pValue": 4.1e-8,
                "adjPValue": 3.1e-7,
                "baseMean": 12450.0,
                "values": {
                    "Ctrl_1": 6.5,
                    "Ctrl_2": 6.3,
                    "Ctrl_3": 6.7,
                    "Tumor_1": 8.6,
                    "Tumor_2": 8.9,
                    "Tumor_3": 8.5,
                },
            },
            {
                "id": "PTEN",
                "pathway": "PI3K/AKT",
                "log2FoldChange": -1.94,
                "pValue": 1.8e-7,
                "adjPValue": 1.1e-6,
                "baseMean": 5420.8,
                "values": {
                    "Ctrl_1": 7.9,
                    "Ctrl_2": 8.1,
                    "Ctrl_3": 7.8,
                    "Tumor_1": 5.9,
                    "Tumor_2": 6.1,
                    "Tumor_3": 6.0,
                },
            },
            {
                "id": "CDKN2A",
                "pathway": "Cell Cycle",
                "log2FoldChange": -2.41,
                "pValue": 9.2e-10,
                "adjPValue": 1.1e-8,
                "baseMean": 3180.4,
                "values": {
                    "Ctrl_1": 7.2,
                    "Ctrl_2": 7.5,
                    "Ctrl_3": 7.1,
                    "Tumor_1": 4.8,
                    "Tumor_2": 4.9,
                    "Tumor_3": 4.7,
                },
            },
            {
                "id": "GAPDH",
                "pathway": "Glycolysis",
                "log2FoldChange": 0.24,
                "pValue": 0.41,
                "adjPValue": 0.62,
                "baseMean": 42100.0,
                "values": {
                    "Ctrl_1": 11.2,
                    "Ctrl_2": 11.4,
                    "Ctrl_3": 11.1,
                    "Tumor_1": 11.5,
                    "Tumor_2": 11.4,
                    "Tumor_3": 11.6,
                },
            },
        ],
    }
}


class OmicsRestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Allow CORS so a static GitHub Pages frontend can call this Python API
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/health":
            self._send_json(
                200, {"status": "ok", "service": "omics-rest-api", "version": "1.0"}
            )
            return

        if path == "/api/datasets":
            catalog = [
                {
                    "id": ds["id"],
                    "name": ds["name"],
                    "omicsType": ds["omicsType"],
                    "featureCount": len(ds["features"]),
                    "sampleCount": len(ds["samples"]),
                }
                for ds in SAMPLE_DATASETS.values()
            ]
            self._send_json(200, {"datasets": catalog})
            return

        if path.startswith("/api/datasets/"):
            dataset_id = path.split("/")[-1]
            dataset = SAMPLE_DATASETS.get(dataset_id)
            if not dataset:
                self._send_json(404, {"error": f"Dataset '{dataset_id}' not found"})
                return
            self._send_json(200, dataset)
            return

        self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path.rstrip("/")
        if path != "/api/analyze":
            self._send_json(404, {"error": "Endpoint not found"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        features = payload.get("features", [])
        fc_cutoff = float(payload.get("fcThreshold", 1.0))
        p_cutoff = float(payload.get("pThreshold", 0.05))

        upregulated = []
        downregulated = []
        unchanged = 0

        for item in features:
            fc = float(item.get("log2FoldChange", 0.0))
            pval = float(item.get("adjPValue", item.get("pValue", 1.0)))
            if pval <= p_cutoff and fc >= fc_cutoff:
                upregulated.append(item)
            elif pval <= p_cutoff and fc <= -fc_cutoff:
                downregulated.append(item)
            else:
                unchanged += 1

        upregulated.sort(key=lambda x: x.get("adjPValue", 1.0))
        downregulated.sort(key=lambda x: x.get("adjPValue", 1.0))

        self._send_json(
            200,
            {
                "summary": {
                    "totalFeatures": len(features),
                    "upregulatedCount": len(upregulated),
                    "downregulatedCount": len(downregulated),
                    "unchangedCount": unchanged,
                    "fcThreshold": fc_cutoff,
                    "pThreshold": p_cutoff,
                },
                "topUpregulated": [f.get("id") for f in upregulated[:5]],
                "topDownregulated": [f.get("id") for f in downregulated[:5]],
            },
        )


def run() -> None:
    port = int(os.environ.get("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), OmicsRestHandler)
    print(f"Omics REST API listening on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
