/**
 * File Name: compute.ts
 * Project: Acroset
 * Description: Core Acroset calculation engine for validating measurement sets and deriving shim recommendations.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */
export type Unit = "Imperial" | "Metric";
export type Group = "Front" | "Rear";

export interface PointRow {
  torque_ftlb: number;   // y-values (always ft-lb)
  s1_m1?: number;        // x-values in current unit (in/mm), non-negative
  s1_m2?: number;
  s2_m1?: number;
  s2_m2?: number;
}

export interface ComputeInput {
  unit: Unit;
  group: Group;
  modelKey: string;
  torqueArray_ftlb: number[]; // authoritative y-values, always ft-lb
  preload: number;            // in current unit (from preloadList)
  retainerMeasured: number;   // in current unit (from user input)
  rows: PointRow[];           // length must match torqueArray
  thresholds: {
    r2Min: number;            // 0.950
    avgErrMax_ftlb: number;   // 5
    maxErrMax_ftlb: number;   // 10
    pairDevMax: number;       // 0.01 (in) | 0.25 (mm)
    enforceMonotonic: boolean;// true
  };
}

export type WhichFit = "Set1" | "Set2" | "Combined";

export interface FitStats {
  ok: boolean;
  a: number;                 // slope (ft-lb per unit-of-x)
  b: number;                 // intercept (ft-lb)
  r2: number;
  avgErr_ftlb: number;
  maxErr_ftlb: number;
  shimX: number;             // x-intercept - preload (in or mm)
  yAtShim_ftlb: number;      // a*shimX + b
  reasonIfRejected?: string;
}

export interface CalcResult {
  ok: boolean;
  chosen: WhichFit;
  chosenFit?: FitStats;
  set1: FitStats;
  set2: FitStats;
  combined: FitStats;
  message?: string;
}

/**
 * Small helper used when averaging the two measurements in a set.
 */
function avg(a: number, b: number): number {
  return (a + b) / 2;
}

interface RegressionResult {
  a: number;      // slope
  b: number;      // intercept
  r2: number;
  errs: number[]; // residuals y - yhat
}

/**
 * Runs a simple linear regression and returns the fit plus residual errors.
 *
 * Review note:
 * - `x` is the corrected measurement value
 * - `y` is the torque value in ft-lb
 */
function regression(x: number[], y: number[]): RegressionResult {
  const n = x.length;
  if (n < 2) {
    return { a: NaN, b: NaN, r2: NaN, errs: [] };
  }

  let sumx = 0, sumy = 0, sumxx = 0, sumxy = 0;
  for (let i = 0; i < n; i++) {
    sumx += x[i];
    sumy += y[i];
    sumxx += x[i] * x[i];
    sumxy += x[i] * y[i];
  }
  const xbar = sumx / n;
  const ybar = sumy / n;
  const denom = sumxx - n * xbar * xbar;
  const a = denom === 0 ? NaN : (sumxy - n * xbar * ybar) / denom;
  const b = Number.isFinite(a) ? ybar - a * xbar : NaN;

  // compute residuals inline (no unused 'yhat')
  const errs = y.map((yi, i) => yi - (a * x[i] + b));

  const sst = y.reduce((acc, yi) => acc + (yi - ybar) ** 2, 0);
  const ssr = errs.reduce((acc, e) => acc + e * e, 0);
  const r2 = sst === 0 ? NaN : 1 - ssr / sst;

  return { a, b, r2, errs };
}

/**
 * Builds one fit result and derives the shim recommendation from the line.
 */
function fitOne(xs: number[], ys_ftlb: number[], preload: number): FitStats {
  const { a, b, r2, errs } = regression(xs, ys_ftlb);
  const absErrs = errs.map((e) => Math.abs(e));
  const avgErr = absErrs.length ? absErrs.reduce((s, e) => s + e, 0) / absErrs.length : NaN;
  const maxErr = absErrs.length ? absErrs.reduce((m, e) => Math.max(m, e), 0) : NaN;

  const xIntercept = -(b / a);
  const shimX = xIntercept - preload;
  const yAtShim = a * shimX + b;

  return {
    ok: Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(r2) && Number.isFinite(shimX),
    a, b, r2,
    avgErr_ftlb: avgErr,
    maxErr_ftlb: maxErr,
    shimX,
    yAtShim_ftlb: yAtShim,
  };
}

/**
 * Confirms that each average measurement stays the same or decreases as the
 * torque points move down the table.
 */
function checkMonotonic(avgs: number[]): boolean {
  for (let i = 1; i < avgs.length; i++) {
    if (avgs[i] > avgs[i - 1]) return false;
  }
  return true;
}

/**
 * Validates each pair of measurements before regression.
 *
 * Each row has two measurements per set. If the pair is too far apart, the set
 * is treated as invalid and calculation stops before fitting.
 */
function validatePairDeviation(
  rows: PointRow[],
  pairDevMax: number
): { set1OK: boolean; set2OK: boolean; avgs1: number[]; avgs2: number[] } {
  const avgs1: number[] = [];
  const avgs2: number[] = [];
  let set1OK = true;
  let set2OK = true;

  for (const r of rows) {
    // Set 1
    const a1 = r.s1_m1;
    const b1 = r.s1_m2;
    if (a1 === undefined || a1 === null || b1 === undefined || b1 === null || a1 < 0 || b1 < 0 || Math.abs(a1 - b1) > pairDevMax) {
      set1OK = false;
    } else {
      avgs1.push(avg(a1, b1));
    }

    // Set 2
    const a2 = r.s2_m1;
    const b2 = r.s2_m2;
    if (a2 === undefined || a2 === null || b2 === undefined || b2 === null || a2 < 0 || b2 < 0 || Math.abs(a2 - b2) > pairDevMax) {
      set2OK = false;
    } else {
      avgs2.push(avg(a2, b2));
    }
  }
  return { set1OK, set2OK, avgs1, avgs2 };
}

/**
 * Applies business-rule thresholds after a regression line is calculated.
 */
function applyThresholds(f: FitStats, th: ComputeInput["thresholds"]): FitStats {
  const reasons: string[] = [];
  if (!(f.r2 >= th.r2Min)) reasons.push(`R² < ${th.r2Min}`);
  if (!(f.avgErr_ftlb <= th.avgErrMax_ftlb)) reasons.push(`Avg error > ${th.avgErrMax_ftlb} ft-lb`);
  if (!(f.maxErr_ftlb <= th.maxErrMax_ftlb)) reasons.push(`Max error > ${th.maxErrMax_ftlb} ft-lb`);
  return reasons.length ? { ...f, ok: false, reasonIfRejected: reasons.join("; ") } : { ...f, ok: true };
}

/**
 * Chooses the winning fit.
 *
 * The current preference order is:
 * 1. lowest max error
 * 2. lowest average error
 * 3. highest R²
 * 4. prefer the combined fit as a tie-breaker
 */
function chooseBest(a: FitStats, b: FitStats, c: FitStats): { chosen: WhichFit; fit?: FitStats } {
  const candidates: { id: WhichFit; f: FitStats }[] = [];
  if (a.ok) candidates.push({ id: "Set1", f: a });
  if (b.ok) candidates.push({ id: "Set2", f: b });
  if (c.ok) candidates.push({ id: "Combined", f: c });

  if (!candidates.length) return { chosen: "Combined" }; // none passed

  // Sort by: lowest maxErr -> lowest avgErr -> highest R² -> prefer Combined
  candidates.sort((p, q): number => {
    const byMax = p.f.maxErr_ftlb - q.f.maxErr_ftlb;
    if (byMax !== 0) return byMax;
    const byAvg = p.f.avgErr_ftlb - q.f.avgErr_ftlb;
    if (byAvg !== 0) return byAvg;
    const byR2 = q.f.r2 - p.f.r2; // higher better
    if (byR2 !== 0) return byR2;
    if (p.id === "Combined" && q.id !== "Combined") return -1;
    if (q.id === "Combined" && p.id !== "Combined") return 1;
    return 0;
  });

  return { chosen: candidates[0].id, fit: candidates[0].f };
}

/**
 * Main entry point used by the React form.
 *
 * This function does not know anything about the UI. It accepts already parsed
 * values, validates them, performs the math, and returns a plain result object
 * that the UI can render or save.
 */
export function compute(input: ComputeInput): CalcResult {
  const { torqueArray_ftlb, preload, retainerMeasured, rows, thresholds } = input;

  if (rows.length !== torqueArray_ftlb.length) {
    const message = "Row count mismatch";
    const empty: FitStats = { ok: false, a: NaN, b: NaN, r2: NaN, avgErr_ftlb: NaN, maxErr_ftlb: NaN, shimX: NaN, yAtShim_ftlb: NaN, reasonIfRejected: message };
    return { ok: false, chosen: "Combined", set1: empty, set2: empty, combined: empty, message };
  }

  // Reject obviously bad measurement sets before running regression.
  const { set1OK, set2OK, avgs1, avgs2 } = validatePairDeviation(rows, thresholds.pairDevMax);
  if (thresholds.enforceMonotonic) {
    if (set1OK && !checkMonotonic(avgs1)) return fail("Set 1 is not non-increasing");
    if (set2OK && !checkMonotonic(avgs2)) return fail("Set 2 is not non-increasing");
  }
  if (!set1OK || !set2OK) {
    const reason = !set1OK && !set2OK
      ? "Pair deviation invalid in both sets"
      : !set1OK
      ? "Pair deviation invalid in Set 1"
      : "Pair deviation invalid in Set 2";
    return fail(reason);
  }

  // Convert raw averages into the x-values used by the fit.
  // The measured retainer is subtracted first so the fit is based on the
  // corrected clearance value rather than the raw measured number.
  let xs1 = avgs1.map((v) => v - retainerMeasured);
  let xs2 = avgs2.map((v) => v - retainerMeasured);
  let xsCombined = xs1.map((v, i) => (v + xs2[i]) / 2);

  let ys = torqueArray_ftlb;

  // Trim the same points from every candidate fit.
  // This preserves the current business rule without mixing different point
  // counts between Set 1, Set 2, and Combined.
  if (xs1.length >= 5 && ys.length >= 5) {
    const START = 2;
    const END_EXCL = xs1.length - 1;
    xs1 = xs1.slice(START, END_EXCL);
    xs2 = xs2.slice(START, END_EXCL);
    xsCombined = xsCombined.slice(START, END_EXCL);
    ys = ys.slice(START, END_EXCL);
  }

  // Evaluate all three candidate fits, then let chooseBest() decide the winner.
  const fit1 = applyThresholds(fitOne(xs1, ys, preload), thresholds);
  const fit2 = applyThresholds(fitOne(xs2, ys, preload), thresholds);
  const fitC = applyThresholds(fitOne(xsCombined, ys, preload), thresholds);

  const chosen = chooseBest(fit1, fit2, fitC);
  if (!chosen.fit) {
    const message = `Calculation Failed! Engineering has been notified of the issue. Please retry acroset process and recalculate.`;
    return { ok: false, chosen: "Combined", set1: fit1, set2: fit2, combined: fitC, message };
  }

  return { ok: true, chosen: chosen.chosen, chosenFit: chosen.fit, set1: fit1, set2: fit2, combined: fitC };

  /**
   * Local helper that returns the same "failed" shape used throughout the UI.
   */
  function fail(message: string): CalcResult {
    const empty: FitStats = { ok: false, a: NaN, b: NaN, r2: NaN, avgErr_ftlb: NaN, maxErr_ftlb: NaN, shimX: NaN, yAtShim_ftlb: NaN, reasonIfRejected: message };
    return { ok: false, chosen: "Combined", set1: empty, set2: empty, combined: empty, message };
  }
}
