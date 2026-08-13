import { calculateMetrics, calculatePointErrors, toShimPoints } from "./regression";
import type {
  Dataset,
  HistoricalResult,
  HistoricalRun,
  RegressionKey,
  RegressionResult,
} from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function columnIndex(headers: string[], names: string[]): number {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  return names.reduce((found, name) => found >= 0 ? found : normalized.indexOf(name), -1);
}

export function parseMeasurementCsv(fileName: string, text: string): Dataset[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV has no data rows");
  const headers = rows[0];
  const runColumn = columnIndex(headers, ["run_id", "runid"]);
  const indexColumn = columnIndex(headers, ["torque_index", "index"]);
  const torqueColumn = columnIndex(headers, ["torque_ftlb", "torque", "y"]);
  const setColumn = columnIndex(headers, ["set_id", "set"]);
  const valueColumn = columnIndex(headers, ["value", "measurement", "x"]);
  const unitColumn = columnIndex(headers, ["value_unit", "unit"]);
  if (runColumn < 0 || torqueColumn < 0 || valueColumn < 0) {
    throw new Error("Expected run_id, torque_ftlb, and value columns");
  }

  type Group = { runId: string; setId: string; unit: string; values: Map<number, { y: number; xs: number[] }> };
  const groups = new Map<string, Group>();
  rows.slice(1).forEach((cells, rowNumber) => {
    const y = Number(cells[torqueColumn]);
    const x = Number(cells[valueColumn]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const runId = cells[runColumn] || fileName;
    const setId = setColumn >= 0 ? cells[setColumn] || "Imported" : "Imported";
    const torqueIndex = indexColumn >= 0 ? Number(cells[indexColumn]) : rowNumber + 1;
    const unit = unitColumn >= 0 ? cells[unitColumn] || "value" : "value";
    const key = `${runId}\u0000${setId}`;
    const group = groups.get(key) ?? { runId, setId, unit, values: new Map() };
    const value = group.values.get(torqueIndex) ?? { y, xs: [] };
    value.xs.push(x);
    group.values.set(torqueIndex, value);
    groups.set(key, group);
  });

  const datasets: Dataset[] = [];
  for (const group of groups.values()) {
    const points = [...group.values.entries()]
      .sort(([left], [right]) => left - right)
      .map(([torqueIndex, value]) => ({
        torqueIndex,
        y: value.y,
        x: value.xs.reduce((sum, item) => sum + item, 0) / value.xs.length,
      }));
    if (points.length < 2) continue;
    datasets.push({
      id: `${fileName}:${group.runId}:${group.setId}`,
      runId: group.runId,
      name: fileName,
      setId: normalizeSetId(group.setId),
      unit: group.unit,
      points,
    });
  }

  const set1 = datasets.find((dataset) => dataset.setId === "Set1");
  const set2 = datasets.find((dataset) => dataset.setId === "Set2");
  if (set1 && set2 && set1.points.length === set2.points.length) {
    datasets.push({
      id: `${fileName}:${set1.runId}:Combined`,
      runId: set1.runId,
      name: fileName,
      setId: "Combined",
      unit: set1.unit,
      points: set1.points.map((point, index) => ({
        ...point,
        x: (point.x + set2.points[index].x) / 2,
      })),
    });
  }
  if (!datasets.length) throw new Error("No usable measurement sets found");
  return datasets;
}

export function parseResultCsv(text: string): HistoricalResult {
  const rows = parseCsv(text);
  if (rows.length !== 2) throw new Error(`Expected one result row, found ${Math.max(0, rows.length - 1)}`);
  const headers = rows[0];
  const cells = rows[1];
  const value = (name: string): string => {
    const index = columnIndex(headers, [name]);
    return index >= 0 ? cells[index] ?? "" : "";
  };
  const number = (name: string): number => Number(value(name));
  const optionalNumber = (name: string): number | undefined => {
    const raw = value(name);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  // Historic exports wrote the chosen fields as value, torque, unit while the
  // header says value, unit, torque. Detect and interpret that known inversion.
  const declaredChosenUnit = value("chosen_shim_unit");
  const declaredChosenTorque = value("chosen_shim_torque_ftlb");
  const chosenFieldsSwapped = declaredChosenTorque !== "" && !Number.isFinite(Number(declaredChosenTorque));
  const preload = number("preload_ftlb");
  const retainer = number("retainer_measured_value");
  if (!Number.isFinite(preload) || !Number.isFinite(retainer)) {
    throw new Error("Result row is missing a numeric preload or retainer measurement");
  }

  const regression = (key: RegressionKey): RegressionResult => {
    const slope = number(`${key}_slope`);
    const intercept = number(`${key}_intercept`);
    const averageError = number(`${key}_avg_err_ftlb`);
    const maxError = number(`${key}_max_err_ftlb`);
    const r2 = number(`${key}_r2`);
    return {
      start: 2,
      end: -2,
      count: 0,
      slope,
      intercept,
      shimValue: optionalNumber(`${key}_shim_value`),
      shimUnit: value(`${key}_shim_unit`),
      shimTorque: optionalNumber(`${key}_shim_torque_ftlb`),
      metrics: { averageError, maxError, rmse: Number.NaN, r2 },
      allMetrics: { averageError, maxError, rmse: Number.NaN, r2 },
      errors: [],
      status: value(`${key}_status`),
      rejectReason: value(`${key}_reject_reason`),
    };
  };

  return {
    runId: value("run_id"),
    date: value("date_iso"),
    mechanicName: value("mechanic_name"),
    workOrder: value("work_order"),
    location: value("location"),
    units: value("units"),
    group: value("group"),
    model: value("model"),
    preload,
    retainerMeasuredValue: retainer,
    retainerMeasuredUnit: value("retainer_measured_unit"),
    calculationStatus: value("calc_status"),
    chosenFit: value("chosen_fit"),
    chosenShimValue: optionalNumber("chosen_shim_value"),
    chosenShimUnit: chosenFieldsSwapped ? declaredChosenTorque : declaredChosenUnit,
    chosenShimTorque: chosenFieldsSwapped
      ? (Number.isFinite(Number(declaredChosenUnit)) ? Number(declaredChosenUnit) : undefined)
      : optionalNumber("chosen_shim_torque_ftlb"),
    regressions: {
      set1: regression("set1"),
      set2: regression("set2"),
      combined: regression("combined"),
    },
  };
}

export function pairHistoricalRuns(
  measurementFiles: Record<string, string>,
  resultFiles: Record<string, string>,
): HistoricalRun[] {
  const results = new Map<string, HistoricalResult>();
  Object.values(resultFiles).forEach((text) => {
    const result = parseResultCsv(text);
    if (results.has(result.runId)) throw new Error(`Duplicate result run_id: ${result.runId}`);
    results.set(result.runId, result);
  });

  const runs: HistoricalRun[] = [];
  Object.entries(measurementFiles).forEach(([fileName, text]) => {
    const datasets = parseMeasurementCsv(fileName, text);
    const runId = datasets[0].runId;
    const result = results.get(runId);
    if (!result) throw new Error(`No result CSV matched measurement run_id ${runId}`);
    const byKey = {
      set1: datasets.find((dataset) => dataset.setId === "Set1"),
      set2: datasets.find((dataset) => dataset.setId === "Set2"),
      combined: datasets.find((dataset) => dataset.setId === "Combined"),
    };
    if (!byKey.set1 || !byKey.set2 || !byKey.combined) {
      throw new Error(`Run ${runId} does not contain Set1, Set2, and Combined data`);
    }
    (Object.keys(byKey) as RegressionKey[]).forEach((key) => {
      const regression = result.regressions[key];
      const shimPoints = toShimPoints(byKey[key]!.points, result.retainerMeasuredValue);
      regression.start = 2;
      regression.end = shimPoints.length - 2;
      regression.count = Math.max(0, regression.end - regression.start + 1);
      regression.errors = calculatePointErrors(
        shimPoints,
        regression.slope,
        regression.intercept,
        regression.start,
        regression.end,
      );
      regression.allMetrics = calculateMetrics(shimPoints, regression.slope, regression.intercept);
    });
    runs.push({ runId, result, datasets: byKey as Record<RegressionKey, Dataset> });
    results.delete(runId);
  });
  if (results.size) throw new Error(`Found ${results.size} result CSV(s) without matching measurements`);
  return runs.sort((left, right) => right.result.date.localeCompare(left.result.date) || left.runId.localeCompare(right.runId));
}

function normalizeSetId(value: string): Dataset["setId"] {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  if (normalized === "set1" || normalized === "1") return "Set1";
  if (normalized === "set2" || normalized === "2") return "Set2";
  if (normalized === "combined") return "Combined";
  return "Imported";
}
