import type { Bounds, Candidate, Metrics, Point } from "./types";

const EPSILON = 1e-12;

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

function metrics(points: Point[], slope: number, intercept: number): Metrics {
  const errors = points.map((point) => point.y - (slope * point.x + intercept));
  const absoluteErrors = errors.map(Math.abs);
  const squaredError = errors.reduce((sum, error) => sum + error ** 2, 0);
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const totalSquares = points.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
  return {
    averageError: absoluteErrors.reduce((sum, error) => sum + error, 0) / points.length,
    maxError: Math.max(...absoluteErrors),
    rmse: Math.sqrt(squaredError / points.length),
    r2: totalSquares < EPSILON ? Number.NaN : 1 - squaredError / totalSquares,
  };
}

function validate(
  slope: number,
  referenceTorque: number | undefined,
  all: Metrics,
  bounds: Bounds,
): string[] {
  const reasons: string[] = [];
  if (bounds.minSlope !== undefined && slope < bounds.minSlope) reasons.push("slope below minimum");
  if (bounds.maxSlope !== undefined && slope > bounds.maxSlope) reasons.push("slope above maximum");
  if (
    bounds.minReferenceTorque !== undefined &&
    referenceTorque !== undefined &&
    referenceTorque < bounds.minReferenceTorque
  ) reasons.push("reference torque below minimum");
  if (
    bounds.maxReferenceTorque !== undefined &&
    referenceTorque !== undefined &&
    referenceTorque > bounds.maxReferenceTorque
  ) reasons.push("reference torque above maximum");
  if (bounds.maxAverageError !== undefined && all.averageError > bounds.maxAverageError) {
    reasons.push("average error above limit");
  }
  if (bounds.maxPointError !== undefined && all.maxError > bounds.maxPointError) {
    reasons.push("maximum error above limit");
  }
  return reasons;
}

export function generateCandidates(points: Point[], minimumPoints: number, bounds: Bounds): Candidate[] {
  const candidates: Candidate[] = [];
  const safeMinimum = Math.max(2, Math.min(minimumPoints, points.length));
  for (let count = safeMinimum; count <= points.length; count += 1) {
    for (let start = 0; start + count <= points.length; start += 1) {
      const end = start + count - 1;
      const fitPoints = points.slice(start, end + 1);
      const fit = fitLine(fitPoints);
      if (!fit) continue;
      const referenceTorque = bounds.referenceX === undefined
        ? undefined
        : fit.slope * bounds.referenceX + fit.intercept;
      const all = metrics(points, fit.slope, fit.intercept);
      const reasons = validate(fit.slope, referenceTorque, all, bounds);
      candidates.push({
        start,
        end,
        count,
        slope: fit.slope,
        intercept: fit.intercept,
        referenceTorque,
        window: metrics(fitPoints, fit.slope, fit.intercept),
        all,
        accepted: reasons.length === 0,
        reasons,
      });
    }
  }
  return candidates.sort((left, right) => compareCandidates(left, right, bounds));
}

function compareCandidates(left: Candidate, right: Candidate, bounds: Bounds): number {
  if (left.accepted !== right.accepted) return left.accepted ? -1 : 1;
  const maxDifference = left.all.maxError - right.all.maxError;
  if (Math.abs(maxDifference) > EPSILON) return maxDifference;
  const averageDifference = left.all.averageError - right.all.averageError;
  if (Math.abs(averageDifference) > EPSILON) return averageDifference;
  if (left.count !== right.count) return right.count - left.count;
  if (bounds.targetSlope !== undefined) {
    const targetDifference = Math.abs(left.slope - bounds.targetSlope) - Math.abs(right.slope - bounds.targetSlope);
    if (Math.abs(targetDifference) > EPSILON) return targetDifference;
  }
  if (
    bounds.targetReferenceTorque !== undefined &&
    left.referenceTorque !== undefined &&
    right.referenceTorque !== undefined
  ) {
    return Math.abs(left.referenceTorque - bounds.targetReferenceTorque)
      - Math.abs(right.referenceTorque - bounds.targetReferenceTorque);
  }
  return right.all.r2 - left.all.r2;
}

export function currentRuleCandidate(points: Point[]): Candidate | undefined {
  if (points.length < 5) return undefined;
  const fitPoints = points.slice(2, points.length - 1);
  const fit = fitLine(fitPoints);
  if (!fit) return undefined;
  return {
    start: 2,
    end: points.length - 2,
    count: fitPoints.length,
    slope: fit.slope,
    intercept: fit.intercept,
    window: metrics(fitPoints, fit.slope, fit.intercept),
    all: metrics(points, fit.slope, fit.intercept),
    accepted: true,
    reasons: [],
  };
}
