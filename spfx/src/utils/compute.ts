import { parseNumber, linearRegression, round, FitResult } from './calculations';

type RowResult = {
  torque: number;
  m1: number | undefined;
  m2: number | undefined;
  avg: number | undefined;
  gap: number | undefined;
};

export type CalcResult = {
  ok: true;
  rows: RowResult[];
  ptsUsed: { x: number; y: number }[];
  ptsAll: { x: number; y: number }[];
  fit: FitResult;
  xIntercept: number | undefined;
  shimX: number | undefined;
  yAtShim: number | undefined;
  modelOffset: number;
};

const modelOffsets: Record<string, number> = {
  '777 Front': 0.0051,
  '797 Front': 0.0098,
  '830E Front': 0.0059,
  '930E Front': 0.0106,
};

export function computeFromFormState(form: Record<string, string>): CalcResult | { ok: false; reason: string } {
  const { model, retainer: retainerRaw } = form;
  const retainer = parseNumber(retainerRaw);

  const rows: RowResult[] = [];
  const ptsUsed = [];
  const ptsAll = [];

  for (let pos = 1; pos <= 8; pos++) {
    const torque = [0, 20, 40, 60, 80, 100, 120, 140][pos - 1];

    const m1 = parseNumber(form[`meas_s1_1_${pos}`]);
    const m2 = parseNumber(form[`meas_s1_2_${pos}`]);
    const avg = m1 !== undefined && m2 !== undefined
      ? (m1 + m2) / 2
      : m1 ?? m2 ?? undefined;

    const gap = avg !== undefined && retainer !== undefined ? avg - retainer : undefined;

    rows.push({ torque, m1, m2, avg, gap });

    if (gap !== undefined && torque !== undefined) {
      ptsAll.push({ x: gap, y: torque });
    }

    if (gap !== undefined && torque >= 40 && torque <= 140) {
      ptsUsed.push({ x: gap, y: torque });
    }
  }

  if (ptsUsed.length < 2) {
    return { ok: false, reason: "At least two valid data points (40–140 ft-lb) required." };
  }

  const fit = linearRegression(ptsUsed);
  if (!fit) return { ok: false, reason: "Linear regression failed (degenerate data)." };
  if (fit.a > 0) return { ok: false, reason: "Fit slope must be negative. Got: " + round(fit.a, 6) };

  const modelOffset = modelOffsets[model] ?? 0;
  const shimX = fit.xInt !== undefined ? fit.xInt - modelOffset : undefined;
  const yAtShim = shimX !== undefined && isFinite(shimX) ? fit.a * shimX + fit.b : undefined;

  return {
    ok: true,
    rows,
    ptsUsed,
    ptsAll,
    fit,
    xIntercept: fit.xInt,
    shimX,
    yAtShim,
    modelOffset
  };
}
