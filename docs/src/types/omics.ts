export type RegulationStatus = 'upregulated' | 'downregulated' | 'unchanged';

export interface OmicsFeature {
  id: string;
  description?: string;
  pathway: string;
  chromosome?: string;
  log2FoldChange: number;
  pValue: number;
  adjPValue: number;
  baseMean: number;
  values: Record<string, number>;
}

export interface OmicsDataset {
  id: string;
  name: string;
  omicsType: 'Transcriptomics' | 'Proteomics' | 'Metabolomics' | 'Custom Upload' | 'Python REST API';
  conditionA: string;
  conditionB: string;
  samples: string[];
  features: OmicsFeature[];
}

export interface OmicsThresholds {
  fcThreshold: number;
  pThreshold: number;
  searchQuery: string;
  regulationFilter: 'all' | 'upregulated' | 'downregulated';
}

export type DashboardView = 'overview' | 'matrix' | 'api';
