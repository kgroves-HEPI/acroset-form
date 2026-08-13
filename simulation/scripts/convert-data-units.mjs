import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const simulationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(simulationRoot, "data");
const destinations = {
  imperial: {
    measurements: path.join(dataRoot, "measurements-imperial"),
    results: path.join(dataRoot, "results-imperial"),
    distanceUnit: "in",
    system: "Imperial",
  },
  metric: {
    measurements: path.join(dataRoot, "measurements-metric"),
    results: path.join(dataRoot, "results-metric"),
    distanceUnit: "mm",
    system: "Metric",
  },
};

const distanceResultColumns = [
  "preload_ftlb",
  "retainer_measured_value",
  "chosen_shim_value",
  "set1_shim_value",
  "set2_shim_value",
  "combined_shim_value",
];
const distanceUnitResultColumns = [
  "retainer_measured_unit",
  "chosen_shim_unit",
  "set1_shim_unit",
  "set2_shim_unit",
  "combined_shim_unit",
];
const slopeResultColumns = ["set1_slope", "set2_slope", "combined_slope"];

await Promise.all(Object.values(destinations).flatMap((destination) => [
  fs.mkdir(destination.measurements, { recursive: true }),
  fs.mkdir(destination.results, { recursive: true }),
]));

const measurementCount = await convertMeasurementFiles();
const resultCount = await convertResultFiles();
console.log(`Converted ${measurementCount} measurement files and ${resultCount} result files into both unit systems.`);

async function convertMeasurementFiles() {
  const sourceDirectory = path.join(dataRoot, "measurements");
  const files = (await fs.readdir(sourceDirectory)).filter((name) => name.toLowerCase().endsWith(".csv"));
  for (const fileName of files) {
    const sourcePath = path.join(sourceDirectory, fileName);
    const sourceText = await fs.readFile(sourcePath, "utf8");
    const rows = parseCsv(sourceText);
    requireSingleHeader(rows, fileName);
    const headers = rows[0];
    const valueIndex = requiredColumn(headers, "value", fileName);
    const unitIndex = requiredColumn(headers, "value_unit", fileName);
    const sourceUnits = new Set(rows.slice(1).map((row) => normalizeDistanceUnit(row[unitIndex], fileName)));
    if (sourceUnits.size !== 1) throw new Error(`${fileName} contains mixed measurement units`);
    const sourceUnit = [...sourceUnits][0];

    for (const destination of Object.values(destinations)) {
      const outputPath = path.join(destination.measurements, fileName);
      if (sourceUnit === destination.distanceUnit) {
        await fs.copyFile(sourcePath, outputPath);
        continue;
      }
      const converted = rows.map((row, index) => {
        if (index === 0) return [...row];
        const next = [...row];
        next[valueIndex] = convertDistance(next[valueIndex], sourceUnit, destination.distanceUnit, `${fileName} value`);
        next[unitIndex] = destination.distanceUnit;
        return next;
      });
      await fs.writeFile(outputPath, serializeCsv(converted), "utf8");
    }
  }
  return files.length;
}

async function convertResultFiles() {
  const sourceDirectory = path.join(dataRoot, "results");
  const files = (await fs.readdir(sourceDirectory)).filter((name) => name.toLowerCase().endsWith(".csv"));
  for (const fileName of files) {
    const sourceText = await fs.readFile(path.join(sourceDirectory, fileName), "utf8");
    const rows = parseCsv(sourceText);
    requireSingleHeader(rows, fileName);
    const headers = rows[0];
    const systemIndex = requiredColumn(headers, "units", fileName);
    const chosenUnitIndex = requiredColumn(headers, "chosen_shim_unit", fileName);
    const chosenTorqueIndex = requiredColumn(headers, "chosen_shim_torque_ftlb", fileName);
    const sourceSystem = rows[1][systemIndex];
    const sourceUnit = sourceSystem === "Imperial" ? "in" : sourceSystem === "Metric" ? "mm" : undefined;
    if (!sourceUnit) throw new Error(`${fileName} has unsupported unit system: ${sourceSystem}`);

    // The legacy export wrote chosen shim fields as value, torque, unit despite
    // the declared header order value, unit, torque. Normalize them here.
    const normalizedRows = rows.map((row, index) => {
      if (index === 0) return [...row];
      const next = [...row];
      if (isDistanceUnit(next[chosenTorqueIndex])) {
        const legacyTorque = next[chosenUnitIndex];
        next[chosenUnitIndex] = next[chosenTorqueIndex];
        next[chosenTorqueIndex] = legacyTorque;
      }
      return next;
    });

    for (const destination of Object.values(destinations)) {
      const converted = normalizedRows.map((row, index) => {
        if (index === 0) return [...row];
        const next = [...row];
        next[systemIndex] = destination.system;
        for (const column of distanceResultColumns) {
          const columnIndex = requiredColumn(headers, column, fileName);
          next[columnIndex] = convertDistance(next[columnIndex], sourceUnit, destination.distanceUnit, `${fileName} ${column}`);
        }
        for (const column of distanceUnitResultColumns) {
          next[requiredColumn(headers, column, fileName)] = destination.distanceUnit;
        }
        for (const column of slopeResultColumns) {
          const columnIndex = requiredColumn(headers, column, fileName);
          next[columnIndex] = convertSlope(next[columnIndex], sourceUnit, destination.distanceUnit, `${fileName} ${column}`);
        }
        return next;
      });
      await fs.writeFile(path.join(destination.results, fileName), serializeCsv(converted), "utf8");
    }
  }
  return files.length;
}

function convertDistance(rawValue, fromUnit, toUnit, label) {
  if (rawValue === "") return "";
  if (fromUnit === toUnit) return rawValue;
  const value = numericValue(rawValue, label);
  return formatNumber(fromUnit === "in" ? value * 25.4 : value / 25.4);
}

function convertSlope(rawValue, fromUnit, toUnit, label) {
  if (rawValue === "") return "";
  if (fromUnit === toUnit) return rawValue;
  const value = numericValue(rawValue, label);
  // Torque/distance slopes scale inversely to the distance coordinate.
  return formatNumber(fromUnit === "in" ? value / 25.4 : value * 25.4);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error(`Conversion produced a non-finite number: ${value}`);
  return Number(value.toPrecision(15)).toString();
}

function numericValue(rawValue, label) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) throw new Error(`${label} is not numeric: ${rawValue}`);
  return value;
}

function requiredColumn(headers, name, fileName) {
  const index = headers.findIndex((header) => header.trim().toLowerCase() === name);
  if (index < 0) throw new Error(`${fileName} is missing column ${name}`);
  return index;
}

function normalizeDistanceUnit(value, fileName) {
  const normalized = value.trim().toLowerCase();
  if (!isDistanceUnit(normalized)) throw new Error(`${fileName} has unsupported distance unit: ${value}`);
  return normalized;
}

function isDistanceUnit(value) {
  return value.trim().toLowerCase() === "in" || value.trim().toLowerCase() === "mm";
}

function requireSingleHeader(rows, fileName) {
  if (rows.length < 2) throw new Error(`${fileName} contains no data rows`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
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
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted value");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function serializeCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

function escapeCsv(value) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
