export function parseNumber(value: string | number | undefined | undefined): number | undefined {
  if (value === undefined || value === undefined) return undefined;
  const x = parseFloat(String(value).trim());
  return Number.isFinite(x) ? x : undefined;
}

export function round(value: number, decimals = 6): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

export type Point = { x: number; y: number };

export type FitResult = {
  a: number;
  b: number;
  r2: number;
  xInt: number | undefined;
  avgErr: number;
  maxErr: number;
};

export function linearRegression(points: Point[]): FitResult | undefined {
  const n = points.length;
  if (n < 2) return undefined;

  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { x, y } of points) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }

  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return undefined;

  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;

  let ssTot = 0, ssRes = 0, absSum = 0, absMax = 0;
  const yMean = sy / n;

  for (const { x, y } of points) {
    const yHat = a * x + b;
    const err = Math.abs(y - yHat);
    ssTot += (y - yMean) ** 2;
    ssRes += (y - yHat) ** 2;
    absSum += err;
    if (err > absMax) absMax = err;
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const xInt = Math.abs(a) < 1e-12 ? undefined : -b / a;
  const avgErr = absSum / n;

  return { a, b, r2, xInt, avgErr, maxErr: absMax };
}
