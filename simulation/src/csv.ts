import type { Dataset, Point } from "./types";

function parseCsv(text: string): string[][] {
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
  if (torqueColumn < 0 || valueColumn < 0) {
    throw new Error("Expected torque_ftlb and value columns");
  }

  type Group = { runId: string; setId: string; unit: string; values: Map<number, { y: number; xs: number[] }> };
  const groups = new Map<string, Group>();
  rows.slice(1).forEach((cells, rowNumber) => {
    const y = Number(cells[torqueColumn]);
    const x = Number(cells[valueColumn]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const runId = runColumn >= 0 ? cells[runColumn] || fileName : fileName;
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
    const points: Point[] = [...group.values.entries()]
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

  const byRun = new Map<string, Dataset[]>();
  datasets.forEach((dataset) => {
    const list = byRun.get(dataset.runId) ?? [];
    list.push(dataset);
    byRun.set(dataset.runId, list);
  });
  for (const [runId, sets] of byRun) {
    const set1 = sets.find((dataset) => dataset.setId === "Set1");
    const set2 = sets.find((dataset) => dataset.setId === "Set2");
    if (!set1 || !set2 || set1.points.length !== set2.points.length) continue;
    datasets.push({
      id: `${fileName}:${runId}:Combined`,
      runId,
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

function normalizeSetId(value: string): Dataset["setId"] {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  if (normalized === "set1" || normalized === "1") return "Set1";
  if (normalized === "set2" || normalized === "2") return "Set2";
  if (normalized === "combined") return "Combined";
  return "Imported";
}

export function exportCsv(rows: Array<Record<string, string | number | boolean | undefined>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    const text = value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
