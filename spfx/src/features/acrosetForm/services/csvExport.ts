/**
 * File Name: csvExport.ts
 * Project: Acroset
 * Description: CSV builders for Acroset results and measurement export files.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import type { CalcResult, Unit } from "../calculation/compute";
import type { RowMeasurement } from "../types";

type FitId = "Set1" | "Set2" | "Combined";
type FitStats = CalcResult["set1"];

const quoteCsvValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

const buildCsvLine = (values: Array<string | number>) =>
  `${values.map(quoteCsvValue).join(",")}\n`;

const toNumberOrBlank = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : "";

export function buildResultsCsv(args: {
  run_id: string;
  date_iso: string;
  mechanic_name: string;
  work_order: string;
  location: string;
  units: Unit;
  group: string;
  model: string;
  preload_ftlb: number;
  retainer_measured_value: number | string;
  result: CalcResult;
}) {
  const {
    run_id,
    date_iso,
    mechanic_name,
    work_order,
    location,
    units,
    group,
    model,
    preload_ftlb,
    retainer_measured_value,
    result,
  } = args;

  const unitShim = units === "Imperial" ? "in" : "mm";
  const chosenFit: FitId | "" = result.ok && result.chosen ? result.chosen : "";
  const fitById = (id: FitId): FitStats | undefined =>
    id === "Set1" ? result.set1 : id === "Set2" ? result.set2 : result.combined;

  const chosenStats = chosenFit ? fitById(chosenFit) : undefined;
  const chosenShimValue = chosenStats?.shimX ?? "";
  const chosenShimTorque = toNumberOrBlank(
    (chosenStats as { yAtShim_ftlb?: number } | undefined)?.yAtShim_ftlb
  );
  const calculationStatus = result.ok ? "Pass" : "Fail";

  const extractStats = (fit?: FitStats) => {
    const typedFit = fit as FitStats & {
      slope?: number;
      intercept?: number;
    };

    return {
      slope: toNumberOrBlank(typedFit?.slope ?? typedFit?.a),
      intercept: toNumberOrBlank(typedFit?.intercept ?? typedFit?.b),
      r2: toNumberOrBlank(typedFit?.r2),
      avg: toNumberOrBlank(typedFit?.avgErr_ftlb),
      max: toNumberOrBlank(typedFit?.maxErr_ftlb),
      shim: toNumberOrBlank(typedFit?.shimX),
      shimTorque: toNumberOrBlank(typedFit?.yAtShim_ftlb),
      status:
        typedFit?.ok === undefined ? "" : typedFit.ok ? "Pass" : "Fail",
      reason: typedFit?.ok ? "" : typedFit?.reasonIfRejected ?? "",
    };
  };

  const set1 = extractStats(result.set1);
  const set2 = extractStats(result.set2);
  const combined = extractStats(result.combined);

  let csv = "";
  csv += buildCsvLine([
    "run_id",
    "date_iso",
    "mechanic_name",
    "work_order",
    "location",
    "units",
    "group",
    "model",
    "preload_ftlb",
    "retainer_measured_value",
    "retainer_measured_unit",
    "calc_status",
    "chosen_fit",
    "chosen_shim_value",
    "chosen_shim_unit",
    "chosen_shim_torque_ftlb",
    "set1_slope",
    "set1_intercept",
    "set1_r2",
    "set1_avg_err_ftlb",
    "set1_max_err_ftlb",
    "set1_shim_value",
    "set1_shim_unit",
    "set1_shim_torque_ftlb",
    "set1_status",
    "set1_reject_reason",
    "set2_slope",
    "set2_intercept",
    "set2_r2",
    "set2_avg_err_ftlb",
    "set2_max_err_ftlb",
    "set2_shim_value",
    "set2_shim_unit",
    "set2_shim_torque_ftlb",
    "set2_status",
    "set2_reject_reason",
    "combined_slope",
    "combined_intercept",
    "combined_r2",
    "combined_avg_err_ftlb",
    "combined_max_err_ftlb",
    "combined_shim_value",
    "combined_shim_unit",
    "combined_shim_torque_ftlb",
    "combined_status",
    "combined_reject_reason",
  ]);

  csv += buildCsvLine([
    run_id,
    date_iso,
    mechanic_name,
    work_order,
    location,
    units,
    group,
    model,
    preload_ftlb,
    retainer_measured_value,
    units === "Imperial" ? "in" : "mm",
    calculationStatus,
    chosenFit,
    chosenShimValue,
    chosenShimTorque,
    unitShim,
    set1.slope,
    set1.intercept,
    set1.r2,
    set1.avg,
    set1.max,
    set1.shim,
    unitShim,
    set1.shimTorque,
    set1.status,
    set1.reason,
    set2.slope,
    set2.intercept,
    set2.r2,
    set2.avg,
    set2.max,
    set2.shim,
    unitShim,
    set2.shimTorque,
    set2.status,
    set2.reason,
    combined.slope,
    combined.intercept,
    combined.r2,
    combined.avg,
    combined.max,
    combined.shim,
    unitShim,
    combined.shimTorque,
    combined.status,
    combined.reason,
  ]);

  return csv;
}

export function buildMeasurementsCsv(args: {
  run_id: string;
  rows: RowMeasurement[];
  units: Unit;
}) {
  const { run_id, rows, units } = args;
  const valueUnit = units === "Imperial" ? "in" : "mm";

  let csv = "";
  csv += buildCsvLine([
    "run_id",
    "torque_index",
    "torque_ftlb",
    "set_id",
    "meas_num",
    "value",
    "value_unit",
  ]);

  rows.forEach((row, index) => {
    const torqueIndex = index + 1;
    const torque = toNumberOrBlank(row.torque_ftlb);

    csv += buildCsvLine([
      run_id,
      torqueIndex,
      torque,
      "Set1",
      1,
      toNumberOrBlank(row.s1_m1),
      valueUnit,
    ]);
    csv += buildCsvLine([
      run_id,
      torqueIndex,
      torque,
      "Set1",
      2,
      toNumberOrBlank(row.s1_m2),
      valueUnit,
    ]);
    csv += buildCsvLine([
      run_id,
      torqueIndex,
      torque,
      "Set2",
      1,
      toNumberOrBlank(row.s2_m1),
      valueUnit,
    ]);
    csv += buildCsvLine([
      run_id,
      torqueIndex,
      torque,
      "Set2",
      2,
      toNumberOrBlank(row.s2_m2),
      valueUnit,
    ]);
  });

  return csv;
}
