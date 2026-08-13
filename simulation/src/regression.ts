import type { Metrics, Point, PointError, RegressionResult } from "./types";

const EPSILON = 1e-12;
export const IMPROVED_WINDOW_SIZE = 5;

function fitLine(points: Point[]): { slope: number; intercept: number } | undefined {
  if (points.length < 2) return undefined;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce(
    (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
    0,
  );
  const denominator = points.reduce(
    (sum, point) => sum + (point.x - xMean) ** 2,
    0,
  );
  if (Math.abs(denominator) < EPSILON) return undefined;
  const slope = numerator / denominator;
  return { slope, intercept: yMean - slope * xMean };
}

export function calculateMetrics(points: Point[], slope: number, intercept: number): Metrics {
  const residuals = points.map((point) => point.y - (slope * point.x + intercept));
  const absoluteErrors = residuals.map(Math.abs);
  const squaredError = residuals.reduce((sum, error) => sum + error ** 2, 0);
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const totalSquares = points.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
  return {
    averageError: absoluteErrors.reduce((sum, error) => sum + error, 0) / points.length,
    maxError: Math.max(...absoluteErrors),
    rmse: Math.sqrt(squaredError / points.length),
    r2: totalSquares < EPSILON ? Number.NaN : 1 - squaredError / totalSquares,
  };
}

export function calculatePointErrors(
  points: Point[],
  slope: number,
  intercept: number,
  start: number,
  end: number,
): PointError[] {
  return points.map((point, index) => {
    const predicted = slope * point.x + intercept;
    const residual = point.y - predicted;
    return {
      ...point,
      predicted,
      residual,
      absoluteError: Math.abs(residual),
      included: index >= start && index <= end,
    };
  });
}

export function toShimPoints(points: Point[], retainerMeasuredValue: number): Point[] {
  return points.map((point) => ({ ...point, x: point.x - retainerMeasuredValue }));
}

export function findBestFivePointRegression(
  points: Point[],
  preload: number,
  shimUnit: string,
): RegressionResult | undefined {
  if (points.length < IMPROVED_WINDOW_SIZE) return undefined;
  const candidates: RegressionResult[] = [];
  for (let start = 0; start + IMPROVED_WINDOW_SIZE <= points.length; start += 1) {
    const end = start + IMPROVED_WINDOW_SIZE - 1;
    const window = points.slice(start, end + 1);
    const fit = fitLine(window);
    if (!fit) continue;
    const shimValue = -fit.intercept / fit.slope - preload;
    candidates.push({
      start,
      end,
      count: IMPROVED_WINDOW_SIZE,
      slope: fit.slope,
      intercept: fit.intercept,
      shimValue,
      shimUnit,
      shimTorque: fit.slope * shimValue + fit.intercept,
      metrics: calculateMetrics(window, fit.slope, fit.intercept),
      allMetrics: calculateMetrics(points, fit.slope, fit.intercept),
      errors: calculatePointErrors(points, fit.slope, fit.intercept, start, end),
    });
  }
  return candidates.sort(compareBestFit)[0];
}

function compareBestFit(left: RegressionResult, right: RegressionResult): number {
  const r2Difference = finiteR2(right.metrics.r2) - finiteR2(left.metrics.r2);
  if (Math.abs(r2Difference) > EPSILON) return r2Difference;
  const rmseDifference = left.metrics.rmse - right.metrics.rmse;
  if (Math.abs(rmseDifference) > EPSILON) return rmseDifference;
  const allMaxDifference = left.allMetrics.maxError - right.allMetrics.maxError;
  if (Math.abs(allMaxDifference) > EPSILON) return allMaxDifference;
  return left.start - right.start;
}

function finiteR2(value: number): number {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}
