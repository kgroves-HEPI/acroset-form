export type RegressionKey = "set1" | "set2" | "combined";

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

export interface Metrics {
  averageError: number;
  maxError: number;
  rmse: number;
  r2: number;
}

export interface PointError extends Point {
  predicted: number;
  residual: number;
  absoluteError: number;
  included: boolean;
}

export interface RegressionResult {
  start: number;
  end: number;
  count: number;
  slope: number;
  intercept: number;
  shimValue?: number;
  shimUnit: string;
  shimTorque?: number;
  metrics: Metrics;
  allMetrics: Metrics;
  errors: PointError[];
  status?: string;
  rejectReason?: string;
}

export interface HistoricalResult {
  runId: string;
  date: string;
  mechanicName: string;
  workOrder: string;
  location: string;
  units: string;
  group: string;
  model: string;
  preload: number;
  retainerMeasuredValue: number;
  retainerMeasuredUnit: string;
  calculationStatus: string;
  chosenFit: string;
  chosenShimValue?: number;
  chosenShimUnit: string;
  chosenShimTorque?: number;
  regressions: Record<RegressionKey, RegressionResult>;
}

export interface HistoricalRun {
  runId: string;
  result: HistoricalResult;
  datasets: Record<RegressionKey, Dataset>;
}
