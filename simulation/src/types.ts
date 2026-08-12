export interface Point {
  x: number;
  y: number;
  torqueIndex: number;
}

export interface Dataset {
  id: string;
  runId: string;
  name: string;
  setId: "Set1" | "Set2" | "Combined" | "Imported";
  unit: string;
  points: Point[];
}

export interface Bounds {
  minSlope?: number;
  maxSlope?: number;
  targetSlope?: number;
  referenceX?: number;
  minReferenceTorque?: number;
  maxReferenceTorque?: number;
  targetReferenceTorque?: number;
  maxAverageError?: number;
  maxPointError?: number;
}

export interface Metrics {
  averageError: number;
  maxError: number;
  rmse: number;
  r2: number;
}

export interface Candidate {
  start: number;
  end: number;
  count: number;
  slope: number;
  intercept: number;
  referenceTorque?: number;
  window: Metrics;
  all: Metrics;
  accepted: boolean;
  reasons: string[];
}
