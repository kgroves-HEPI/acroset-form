import "./styles.css";
import { pairHistoricalRuns, parseCsv } from "./csv";
import { findBestFivePointRegression, toShimPoints } from "./regression";
import type { HistoricalRun, RegressionKey, RegressionResult } from "./types";

type UnitSystem = "imperial" | "metric";
type PlotScope = "cluster" | "run";

interface TargetBaseline {
  model: string;
  torqueAverage: number;
  torqueMinimum: number;
  torqueMaximum: number;
  shimAverageInches: number;
  shimMinimumInches: number;
  shimMaximumInches: number;
  targetSlopePerInch: number;
  preloadInches: number;
  preloadMillimeters: number;
}

interface DisplayBaseline {
  label: string;
  torqueAverage: number;
  torqueMinimum: number;
  torqueMaximum: number;
  targetSlope: number;
  shimAverage: number;
  shimMinimum: number;
  shimMaximum: number;
  preload: number;
  unit: string;
}

interface DistributionStatistics {
  count: number;
  minimum: number;
  average: number;
  maximum: number;
  standardDeviation: number;
}

interface ShimClusterStatistics {
  set1: DistributionStatistics;
  set2: DistributionStatistics;
  combined: DistributionStatistics;
  averageAbsoluteDifference: number;
  maximumAbsoluteDifference: number;
  averageSymmetricDifferencePercent: number;
  maximumSymmetricDifferencePercent: number;
  averagePreloadVariationPercent: number;
  maximumPreloadVariationPercent: number;
  combinedWithinTargetPercent: number;
  unit: string;
}

import targetsCsv from "../data/reference/targets.csv?raw";

const imperialMeasurementFiles = import.meta.glob("../data/measurements-imperial/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const imperialResultFiles = import.meta.glob("../data/results-imperial/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const metricMeasurementFiles = import.meta.glob("../data/measurements-metric/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const metricResultFiles = import.meta.glob("../data/results-metric/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const regressionLabels: Record<RegressionKey, string> = {
  set1: "Set 1",
  set2: "Set 2",
  combined: "Combined",
};
const targetBaselines = parseTargetBaselines(targetsCsv);

const runsByUnit: Record<UnitSystem, HistoricalRun[]> = {
  imperial: pairHistoricalRuns(imperialMeasurementFiles, imperialResultFiles),
  metric: pairHistoricalRuns(metricMeasurementFiles, metricResultFiles),
};
if (!runsByUnit.imperial.length || !runsByUnit.metric.length) {
  throw new Error("Both Imperial and Metric historical data collections are required");
}
let selectedUnitSystem: UnitSystem = "imperial";
let selectedRunId = runsByUnit.imperial[0].runId;
let selectedModel = modelClusterKey(runsByUnit.imperial[0]);
let selectedRegression: RegressionKey = "combined";
let plotScope: PlotScope = "cluster";
const improvedRegressionCache = new WeakMap<HistoricalRun, Record<RegressionKey, RegressionResult>>();
const excludedRunIds = new Set<string>();

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="hero">
    <div>
      <p class="eyebrow">Engineering simulation</p>
      <h1>Regression comparison lab</h1>
      <p class="lede">Historic CSV outputs beside an optimized five-point consecutive regression.</p>
    </div>
    <div class="hero-badge"><span>${runsByUnit.imperial.length}</span><small>runs per unit</small></div>
  </header>
  <main>
    <section class="panel run-controls">
      <div class="control-block">
        <p class="section-label">Unit system</p>
        <div id="unit-toggle" class="segmented unit-toggle" role="group" aria-label="Reporting unit system"></div>
      </div>
      <div class="control-block">
        <p class="section-label">Model cluster</p>
        <label for="model-select">Model and group</label>
        <select id="model-select"></select>
      </div>
      <div class="control-block">
        <p class="section-label">Source record</p>
        <label for="run-select">Historic run</label>
        <select id="run-select"></select>
      </div>
      <div class="control-block">
        <p class="section-label">Detail focus</p>
        <div id="regression-tabs" class="segmented" role="group" aria-label="Regression dataset"></div>
      </div>
      <div id="run-meta" class="run-meta"></div>
      <div id="cluster-message" class="cluster-message"></div>
    </section>

    <section class="comparison-grid">
      <article class="panel method-card historic-card">
        <div class="card-heading">
          <div><p class="section-label">01 / Recorded method</p><h2>Historic result</h2></div>
          <span id="historic-status" class="method-status"></span>
        </div>
        <p class="method-copy">Stored regression and output values from the paired results CSV. The fit excludes the first two and final torque points.</p>
        <div id="historic-chart" class="chart"></div>
        <div id="historic-cluster-stats"></div>
        <div id="historic-selected" class="selected-output"></div>
        <div id="historic-summary"></div>
        <div id="historic-errors"></div>
      </article>

      <article class="panel method-card improved-card">
        <div class="card-heading">
          <div><p class="section-label">02 / Proposed method</p><h2>Optimized five-point result</h2></div>
          <span class="method-status proposed">Highest window R²</span>
        </div>
        <p class="method-copy">Fits every possible window of exactly five consecutive points and selects the strongest in-window fit.</p>
        <div id="improved-chart" class="chart"></div>
        <div id="improved-cluster-stats"></div>
        <div id="improved-selected" class="selected-output"></div>
        <div id="improved-summary"></div>
        <div id="improved-errors"></div>
      </article>
    </section>
  </main>
`;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const format = (value: number | undefined, digits = 3): string =>
  value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);

function selectedRun(): HistoricalRun {
  const runs = filteredRuns();
  const run = runs.find((candidate) => candidate.runId === selectedRunId) ?? runs[0];
  if (!run) throw new Error("The selected model has no historical runs");
  selectedRunId = run.runId;
  return run;
}

function activeRuns(): HistoricalRun[] {
  return runsByUnit[selectedUnitSystem];
}

function filteredRuns(): HistoricalRun[] {
  const runs = selectedModel === "all"
    ? activeRuns()
    : activeRuns().filter((run) => modelClusterKey(run) === selectedModel);
  return [...runs].sort(compareRunsByModel);
}

function plottedRuns(): HistoricalRun[] {
  return filteredRuns().filter((run) =>
    !excludedRunIds.has(run.runId) && (plotScope === "cluster" || run.runId === selectedRunId)
  );
}

function modelClusterKey(run: HistoricalRun): string {
  return `${run.result.model}::${run.result.group}`;
}

function modelClusterLabel(run: HistoricalRun): string {
  return `${run.result.model} · ${run.result.group}`;
}

function targetBaselineKey(model: string, group: string): string {
  const normalizedModel = model.trim().toUpperCase();
  const normalizedGroup = group.trim().toUpperCase();
  if (normalizedModel === "777 (WET)") return "777 FRONT (WET)";
  if (normalizedModel === "793EL") return `793 EL ${normalizedGroup}`;
  if (normalizedModel === "793") return `793 STD ${normalizedGroup}`;
  return `${normalizedModel} ${normalizedGroup}`;
}

function parseTargetBaselines(text: string): Map<string, TargetBaseline> {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("targets.csv contains no baseline rows");
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const column = (name: string): number => {
    const index = headers.indexOf(name);
    if (index < 0) throw new Error(`targets.csv is missing ${name}`);
    return index;
  };
  const numeric = (row: string[], name: string): number => {
    const value = Number(row[column(name)]);
    if (!Number.isFinite(value)) throw new Error(`targets.csv has a nonnumeric ${name}`);
    return value;
  };
  return new Map(rows.slice(1).map((row) => {
    const model = row[column("model")];
    return [model.trim().toUpperCase(), {
      model,
      torqueAverage: numeric(row, "torque-avg"),
      torqueMaximum: numeric(row, "torque-max"),
      torqueMinimum: numeric(row, "torque-min"),
      shimAverageInches: numeric(row, "shim-avg"),
      shimMaximumInches: numeric(row, "shim-max"),
      shimMinimumInches: numeric(row, "shim-min"),
      targetSlopePerInch: numeric(row, "target slope"),
      preloadInches: numeric(row, "preload-target-in"),
      preloadMillimeters: numeric(row, "preload-target-mm"),
    }];
  }));
}

function baselineForRun(run: HistoricalRun): DisplayBaseline | undefined {
  const baseline = targetBaselines.get(targetBaselineKey(run.result.model, run.result.group));
  if (!baseline) return undefined;
  const metric = selectedUnitSystem === "metric";
  return {
    label: baseline.model,
    torqueAverage: baseline.torqueAverage,
    torqueMinimum: baseline.torqueMinimum,
    torqueMaximum: baseline.torqueMaximum,
    targetSlope: metric ? -Math.abs(baseline.targetSlopePerInch) / 25.4 : -Math.abs(baseline.targetSlopePerInch),
    shimAverage: metric ? baseline.shimAverageInches * 25.4 : baseline.shimAverageInches,
    shimMinimum: metric ? baseline.shimMinimumInches * 25.4 : baseline.shimMinimumInches,
    shimMaximum: metric ? baseline.shimMaximumInches * 25.4 : baseline.shimMaximumInches,
    // Use the Imperial baseline as canonical so both displays describe the
    // same physical band; the CSV's Metric column is retained for reference.
    preload: metric ? baseline.preloadInches * 25.4 : baseline.preloadInches,
    unit: metric ? "mm" : "in",
  };
}

function compareRunsByModel(left: HistoricalRun, right: HistoricalRun): number {
  return modelClusterLabel(left).localeCompare(modelClusterLabel(right), undefined, { numeric: true })
    || right.result.date.localeCompare(left.result.date)
    || left.runId.localeCompare(right.runId, undefined, { numeric: true });
}

function improvedRegressions(run: HistoricalRun): Record<RegressionKey, RegressionResult> {
  const cached = improvedRegressionCache.get(run);
  if (cached) return cached;
  const calculated = Object.fromEntries((Object.keys(regressionLabels) as RegressionKey[]).map((key) => {
    const points = toShimPoints(run.datasets[key].points, run.result.retainerMeasuredValue);
    const result = findBestFivePointRegression(points, run.result.preload, run.datasets[key].unit);
    if (!result) throw new Error(`${run.runId} ${key} has fewer than five usable points`);
    return [key, result];
  })) as Record<RegressionKey, RegressionResult>;
  improvedRegressionCache.set(run, calculated);
  return calculated;
}

function render(): void {
  const run = selectedRun();
  const improved = improvedRegressions(run);
  const clusterRuns = plottedRuns();
  const modelRuns = filteredRuns();
  const excludedCount = modelRuns.filter((modelRun) => excludedRunIds.has(modelRun.runId)).length;
  const baseline = selectedModel === "all" ? undefined : baselineForRun(run);
  const improvedByRun = new Map(clusterRuns.map((clusterRun) => [clusterRun.runId, improvedRegressions(clusterRun)]));
  renderUnitToggle();
  renderModelSelector();
  renderRunSelector();
  renderTabs();
  byId("run-meta").innerHTML = `
    <div><span>Work order</span><strong>${escapeHtml(run.result.workOrder)}</strong></div>
    <div><span>Date</span><strong>${escapeHtml(run.result.date)}</strong></div>
    <div><span>Configuration</span><strong>${escapeHtml(modelClusterLabel(run))}</strong></div>
    <div><span>Retainer / preload</span><strong>${format(run.result.retainerMeasuredValue, 4)} / ${format(run.result.preload, 4)} ${escapeHtml(run.result.retainerMeasuredUnit)}</strong></div>
    <div><span>Active source</span><strong>${selectedUnitSystem === "imperial" ? "Imperial · inches" : "Metric · millimeters"}</strong></div>`;
  byId("cluster-message").classList.remove("error");
  const selectedExcluded = excludedRunIds.has(run.runId);
  byId("cluster-message").innerHTML = `<div class="cluster-summary"><strong>${plotScope === "run" ? (selectedExcluded ? "Selected record excluded" : "1 selected record plotted") : `${clusterRuns.length} of ${modelRuns.length} records plotted`}</strong><span>${plotScope === "run" ? escapeHtml(run.runId) : selectedModel === "all" ? "All model/group clusters" : escapeHtml(modelClusterLabel(run))}${excludedCount ? ` · ${excludedCount} manually excluded` : ""}</span></div>
    <div class="cluster-actions">${plotScope === "run" ? `<button type="button" class="record-filter cluster-view" data-plot-cluster>Show model cluster</button>` : ""}<button type="button" class="record-filter ${selectedExcluded ? "include" : "exclude"}" data-record-filter>${selectedExcluded ? "Include selected record" : "Exclude selected record"}</button></div>`;
  byId("historic-status").textContent = run.result.calculationStatus || "Recorded";
  byId("historic-status").className = `method-status ${run.result.calculationStatus.toLowerCase() === "pass" ? "pass" : "fail"}`;

  const historic = run.result.regressions[selectedRegression];
  const proposed = improved[selectedRegression];
  renderClusterChart(
    "historic-chart",
    clusterRuns,
    (clusterRun) => clusterRun.result.regressions,
    run.datasets.combined.unit,
    "historic",
    baseline,
  );
  renderClusterChart(
    "improved-chart",
    clusterRuns,
    (clusterRun) => improvedByRun.get(clusterRun.runId)!,
    run.datasets.combined.unit,
    "improved",
    baseline,
  );
  renderShimClusterScorecard(
    "historic-cluster-stats",
    clusterRuns,
    (clusterRun) => clusterRun.result.regressions,
    baseline,
  );
  renderShimClusterScorecard(
    "improved-cluster-stats",
    clusterRuns,
    (clusterRun) => improvedByRun.get(clusterRun.runId)!,
    baseline,
  );
  renderSelectedOutput("historic-selected", historic, "CSV output");
  renderSelectedOutput("improved-selected", proposed, `Points ${proposed.start + 1}–${proposed.end + 1}`);
  byId("historic-summary").innerHTML = renderRegressionSummary(run.result.regressions, run.result.chosenFit);
  byId("improved-summary").innerHTML = renderRegressionSummary(improved);
  byId("historic-errors").innerHTML = renderErrorTable(historic, "Historic point errors");
  byId("improved-errors").innerHTML = renderErrorTable(proposed, "Proposed point errors");
}

function renderRunSelector(): void {
  const select = byId<HTMLSelectElement>("run-select");
  const groups = new Map<string, HistoricalRun[]>();
  filteredRuns().forEach((run) => {
    const label = modelClusterLabel(run);
    const group = groups.get(label) ?? [];
    group.push(run);
    groups.set(label, group);
  });
  select.innerHTML = [...groups.entries()].map(([label, runs]) =>
    `<optgroup label="${escapeHtml(`${label} (${runs.length})`)}">${runs.map((run) =>
      `<option value="${escapeHtml(run.runId)}">${escapeHtml(run.result.date)} · ${escapeHtml(run.result.workOrder)} · ${escapeHtml(run.runId)}${excludedRunIds.has(run.runId) ? " · EXCLUDED" : ""}</option>`
    ).join("")}</optgroup>`
  ).join("");
  select.value = selectedRunId;
}

function renderUnitToggle(): void {
  byId("unit-toggle").innerHTML = (["imperial", "metric"] as UnitSystem[]).map((unitSystem) =>
    `<button type="button" data-unit-system="${unitSystem}" class="${unitSystem === selectedUnitSystem ? "active" : ""}" aria-pressed="${unitSystem === selectedUnitSystem}">${unitSystem === "imperial" ? "Imperial" : "Metric"}</button>`
  ).join("");
}

function renderModelSelector(): void {
  const select = byId<HTMLSelectElement>("model-select");
  const clusters = new Map<string, { label: string; count: number }>();
  activeRuns().forEach((run) => {
    const key = modelClusterKey(run);
    const existing = clusters.get(key);
    clusters.set(key, { label: modelClusterLabel(run), count: (existing?.count ?? 0) + 1 });
  });
  const sorted = [...clusters.entries()].sort((left, right) =>
    left[1].label.localeCompare(right[1].label, undefined, { numeric: true })
  );
  select.innerHTML = `<option value="all">All models (${activeRuns().length} runs)</option>${sorted.map(([key, cluster]) =>
    `<option value="${escapeHtml(key)}">${escapeHtml(cluster.label)} (${cluster.count})</option>`
  ).join("")}`;
  select.value = selectedModel;
}

function renderTabs(): void {
  byId("regression-tabs").innerHTML = (Object.keys(regressionLabels) as RegressionKey[]).map((key) =>
    `<button type="button" data-regression="${key}" class="${key === selectedRegression ? "active" : ""}" aria-pressed="${key === selectedRegression}">${regressionLabels[key]}</button>`
  ).join("");
}

function renderClusterChart(
  targetId: string,
  clusterRuns: HistoricalRun[],
  regressionsForRun: (run: HistoricalRun) => Record<RegressionKey, RegressionResult>,
  unit: string,
  variant: "historic" | "improved",
  baseline: DisplayBaseline | undefined,
): void {
  if (!clusterRuns.length) {
    byId(targetId).innerHTML = `<div class="empty-chart"><strong>No included records</strong><span>Re-include a record to restore this plot.</span></div>`;
    return;
  }
  const width = 760;
  const height = 360;
  const padding = { left: 58, right: 22, top: 24, bottom: 54 };
  const keys = Object.keys(regressionLabels) as RegressionKey[];
  const clusterRegressions = clusterRuns.map((run) => ({ run, regressions: regressionsForRun(run) }));
  const measuredXs = clusterRegressions.flatMap(({ regressions }) => keys.flatMap((key) => [
    ...regressions[key].errors.map((point) => point.x),
    ...(regressions[key].shimValue !== undefined && Number.isFinite(regressions[key].shimValue) ? [regressions[key].shimValue] : []),
  ]));
  const ys = clusterRegressions.flatMap(({ regressions }) =>
    keys.flatMap((key) => regressions[key].errors.map((point) => point.y))
  );
  const outputTorques = clusterRegressions.flatMap(({ regressions }) =>
    keys.map((key) => calculateTorqueIntercept(regressions[key]))
      .filter((value): value is number => value !== undefined && value >= 0)
  );
  const yMin = 0;
  const yMax = Math.max(...ys, ...outputTorques, baseline?.torqueMaximum ?? 0);
  const bandX = (y: number, shim: number): number | undefined => {
    if (!baseline || baseline.targetSlope === 0) return undefined;
    return y / baseline.targetSlope + shim + baseline.preload;
  };
  const baselineXs = baseline
    ? [
      bandX(yMin, baseline.shimMinimum),
      bandX(yMin, baseline.shimMaximum),
      bandX(yMax, baseline.shimMinimum),
      bandX(yMax, baseline.shimMaximum),
    ].filter((value): value is number => value !== undefined && Number.isFinite(value))
    : [];
  const xs = [...measuredXs, ...baselineXs];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xPad = (xMax - xMin || 1) * 0.1;
  const sx = (x: number) => padding.left + ((x - xMin + xPad) / (xMax - xMin + 2 * xPad)) * (width - padding.left - padding.right);
  const sy = (y: number) => height - padding.bottom - ((y - yMin) / (yMax - yMin || 1)) * (height - padding.top - padding.bottom);
  const torqueSettings = [...new Set(ys)].sort((left, right) => left - right);
  const grid = torqueSettings.map((y) =>
    `<line class="grid-line" x1="${padding.left}" y1="${sy(y)}" x2="${width - padding.right}" y2="${sy(y)}"/><text class="axis-text" x="${padding.left - 9}" y="${sy(y) + 4}" text-anchor="end">${format(y, 0)}</text>`
  ).join("");
  const leftX = xMin - xPad;
  const rightX = xMax + xPad;
  const acceptableBand = baseline
    ? `<polygon class="acceptable-band" points="${[
      [bandX(yMin, baseline.shimMinimum), yMin],
      [bandX(yMin, baseline.shimMaximum), yMin],
      [bandX(yMax, baseline.shimMaximum), yMax],
      [bandX(yMax, baseline.shimMinimum), yMax],
    ].map(([x, y]) => `${sx(x!)},${sy(y!)}`).join(" ")}">
        <title>${escapeHtml(baseline.label)} acceptable band: target slope ${format(reportSlope(baseline.targetSlope), 3)} ft-lb/in, shim ${format(baseline.shimMinimum, 4)}–${format(baseline.shimMaximum, 4)} ${escapeHtml(baseline.unit)}</title>
      </polygon>`
    : "";
  const torqueBand = baseline
    ? `<rect class="torque-band" x="${padding.left}" y="${sy(baseline.torqueMaximum)}" width="${width - padding.left - padding.right}" height="${sy(baseline.torqueMinimum) - sy(baseline.torqueMaximum)}">
        <title>${escapeHtml(baseline.label)} acceptable torque: ${format(baseline.torqueMinimum, 1)}–${format(baseline.torqueMaximum, 1)} ft-lb</title>
      </rect>
      <line class="torque-target-line" x1="${padding.left}" y1="${sy(baseline.torqueAverage)}" x2="${width - padding.right}" y2="${sy(baseline.torqueAverage)}">
        <title>${escapeHtml(baseline.label)} target torque average: ${format(baseline.torqueAverage, 1)} ft-lb</title>
      </line>`
    : "";

  const renderSeries = (
    run: HistoricalRun,
    regression: RegressionResult,
    key: RegressionKey,
    isSelectedRun: boolean,
  ): string => {
    const torqueIntercept = calculateTorqueIntercept(regression);
    const focusClass = isSelectedRun
      ? (key === selectedRegression ? "series-focused selected-run" : "series-muted selected-run")
      : "cluster-run";
    const outputGuides = regression.shimValue !== undefined && Number.isFinite(regression.shimValue) &&
      torqueIntercept !== undefined && torqueIntercept >= yMin && torqueIntercept <= yMax
      ? `<line class="output-shim-line series-${key} ${focusClass}" x1="${sx(regression.shimValue)}" y1="${sy(yMin)}" x2="${sx(regression.shimValue)}" y2="${sy(torqueIntercept)}">
          <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} shim output ${format(regression.shimValue, 5)} ${escapeHtml(regression.shimUnit)}</title>
        </line>
        <line class="output-torque-line series-${key} ${focusClass}" x1="${sx(leftX)}" y1="${sy(torqueIntercept)}" x2="${sx(regression.shimValue)}" y2="${sy(torqueIntercept)}">
          <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} torque output ${format(torqueIntercept, 3)} ft-lb</title>
        </line>
        ${isSelectedRun ? `<circle class="shim-intersection series-${key} ${focusClass}" cx="${sx(regression.shimValue)}" cy="${sy(torqueIntercept)}" r="${key === selectedRegression ? 7 : 5}">
          <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} output: ${format(regression.shimValue, 5)} ${escapeHtml(regression.shimUnit)}, ${format(torqueIntercept, 3)} ft-lb</title>
        </circle>` : ""}`
      : "";
    if (!isSelectedRun) {
      const pointPath = regression.errors.map((error) =>
        `M ${sx(error.x) - 1.5} ${sy(error.y)} a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0`
      ).join(" ");
      return `<line class="regression-line ${variant} series-${key} cluster-run" x1="${sx(leftX)}" y1="${sy(regression.slope * leftX + regression.intercept)}" x2="${sx(rightX)}" y2="${sy(regression.slope * rightX + regression.intercept)}">
          <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} regression · slope ${format(reportSlope(regression.slope), 3)} ft-lb/in</title>
        </line>${outputGuides}<path class="cluster-points series-${key} cluster-run" d="${pointPath}">
          <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} measured points</title>
        </path>`;
    }
    const points = regression.errors.map((error, index) => `
      ${isSelectedRun && key === selectedRegression ? `<line class="residual-line series-${key}" x1="${sx(error.x)}" y1="${sy(error.y)}" x2="${sx(error.x)}" y2="${sy(error.predicted)}"/>` : ""}
      <circle class="plot-point series-${key} ${focusClass} ${error.included ? "included" : "excluded"}" cx="${sx(error.x)}" cy="${sy(error.y)}" r="${isSelectedRun ? (error.included ? 5.5 : 3.5) : 2}">
        <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} point ${index + 1}: residual ${format(error.residual, 3)} ft-lb; absolute error ${format(error.absoluteError, 3)} ft-lb</title>
      </circle>
      ${isSelectedRun && key === selectedRegression ? `<text class="point-label" x="${sx(error.x)}" y="${sy(error.y) - 11}" text-anchor="middle">${index + 1}</text>` : ""}`
    ).join("");
    return `<line class="regression-line ${variant} series-${key} ${focusClass}" x1="${sx(leftX)}" y1="${sy(regression.slope * leftX + regression.intercept)}" x2="${sx(rightX)}" y2="${sy(regression.slope * rightX + regression.intercept)}">
        <title>${escapeHtml(run.runId)} · ${regressionLabels[key]} regression · slope ${format(reportSlope(regression.slope), 3)} ft-lb/in</title>
      </line>${outputGuides}${points}`;
  };

  const contextMarkup = clusterRegressions.filter(({ run }) => run.runId !== selectedRunId).map(({ run, regressions }) =>
    keys.map((key) => renderSeries(run, regressions[key], key, false)).join("")
  ).join("");
  const selected = clusterRegressions.find(({ run }) => run.runId === selectedRunId) ?? clusterRegressions[0];
  const selectedMarkup = selected
    ? keys.map((key) => renderSeries(selected.run, selected.regressions[key], key, true)).join("")
    : "";
  const legend = keys.map((key) =>
    `<span class="legend-item ${key === selectedRegression ? "active" : ""}"><i class="series-${key}"></i>${regressionLabels[key]}</span>`
  ).join("") + (baseline ? `<span class="legend-item band-item"><i></i>Slope / shim zone</span><span class="legend-item torque-band-item"><i></i>Torque zone</span>` : "");
  byId(targetId).innerHTML = `<div class="chart-legend">${legend}<small>${clusterRuns.length} runs · ${variant === "historic" ? "dashed historic fits" : "solid proposed fits"}</small></div>
  <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${variant === "historic" ? "Historic" : "Improved"} regressions for ${clusterRuns.length} matching runs">
    ${grid}
    ${torqueBand}
    ${acceptableBand}
    ${contextMarkup}
    ${selectedMarkup}
    <text class="axis-title" x="${width / 2}" y="${height - 12}" text-anchor="middle">Shim-space measurement (${escapeHtml(unit)})</text>
    <text class="axis-title" transform="translate(16 ${height / 2}) rotate(-90)" text-anchor="middle">Torque setting (ft-lb)</text>
  </svg>`;
}

function renderShimClusterScorecard(
  targetId: string,
  clusterRuns: HistoricalRun[],
  regressionsForRun: (run: HistoricalRun) => Record<RegressionKey, RegressionResult>,
  baseline: DisplayBaseline | undefined,
): void {
  const target = byId(targetId);
  if (plotScope !== "cluster" || selectedModel === "all" || !baseline || !clusterRuns.length) {
    target.innerHTML = "";
    target.className = "shim-cluster-scorecard hidden";
    return;
  }
  const statistics = calculateShimClusterStatistics(clusterRuns, regressionsForRun, baseline);
  target.className = "shim-cluster-scorecard";
  target.innerHTML = `
    <div class="scorecard-heading">
      <div><p class="section-label">Shim pack scorecard</p><h3>Model cluster statistics</h3></div>
      <span>${statistics.combined.count} included records · ${escapeHtml(statistics.unit)}</span>
    </div>
    <div class="shim-kpis">
      <article><span>Combined within target</span><strong>${format(statistics.combinedWithinTargetPercent, 1)}%</strong><small>${format(baseline.shimMinimum, 4)}–${format(baseline.shimMaximum, 4)} ${escapeHtml(statistics.unit)}</small></article>
      <article><span>Avg Set 1 / Set 2 difference</span><strong>${format(statistics.averageAbsoluteDifference, 5)} ${escapeHtml(statistics.unit)}</strong><small>Max ${format(statistics.maximumAbsoluteDifference, 5)} ${escapeHtml(statistics.unit)}</small></article>
      <article><span>Avg symmetric difference</span><strong>${format(statistics.averageSymmetricDifferencePercent, 1)}%</strong><small>Max ${format(statistics.maximumSymmetricDifferencePercent, 1)}%</small></article>
      <article><span>Avg variation vs preload</span><strong>${format(statistics.averagePreloadVariationPercent, 1)}%</strong><small>Max ${format(statistics.maximumPreloadVariationPercent, 1)}% · target ${format(baseline.preload, 4)} ${escapeHtml(statistics.unit)}</small></article>
    </div>
    <div class="table-wrap"><table class="shim-stats-table">
      <thead><tr><th>Shim output</th><th>Count</th><th>Minimum</th><th>Average</th><th>Maximum</th><th>Std dev</th></tr></thead>
      <tbody>${([
        ["Set 1", statistics.set1],
        ["Set 2", statistics.set2],
        ["Combined", statistics.combined],
      ] as Array<[string, DistributionStatistics]>).map(([label, distribution]) => `<tr>
        <td><strong>${label}</strong></td><td>${distribution.count}</td><td>${format(distribution.minimum, 5)}</td>
        <td>${format(distribution.average, 5)}</td><td>${format(distribution.maximum, 5)}</td><td>${format(distribution.standardDeviation, 5)}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="scorecard-note">Symmetric difference = |Set 1 − Set 2| ÷ their average magnitude. Preload variation = |Set 1 − Set 2| ÷ target preload.</p>`;
}

function calculateShimClusterStatistics(
  clusterRuns: HistoricalRun[],
  regressionsForRun: (run: HistoricalRun) => Record<RegressionKey, RegressionResult>,
  baseline: DisplayBaseline,
): ShimClusterStatistics {
  const set1: number[] = [];
  const set2: number[] = [];
  const combined: number[] = [];
  const absoluteDifferences: number[] = [];
  const symmetricDifferences: number[] = [];
  const preloadVariations: number[] = [];
  clusterRuns.forEach((run) => {
    const regressions = regressionsForRun(run);
    const first = regressions.set1.shimValue;
    const second = regressions.set2.shimValue;
    const combinedValue = regressions.combined.shimValue;
    if (first !== undefined && Number.isFinite(first)) set1.push(first);
    if (second !== undefined && Number.isFinite(second)) set2.push(second);
    if (combinedValue !== undefined && Number.isFinite(combinedValue)) combined.push(combinedValue);
    if (first === undefined || second === undefined || !Number.isFinite(first) || !Number.isFinite(second)) return;
    const difference = Math.abs(first - second);
    absoluteDifferences.push(difference);
    const averageMagnitude = (Math.abs(first) + Math.abs(second)) / 2;
    if (averageMagnitude > 0) symmetricDifferences.push(difference / averageMagnitude * 100);
    if (baseline.preload > 0) preloadVariations.push(difference / baseline.preload * 100);
  });
  const withinTarget = combined.filter((value) =>
    value >= baseline.shimMinimum && value <= baseline.shimMaximum
  ).length;
  return {
    set1: distributionStatistics(set1),
    set2: distributionStatistics(set2),
    combined: distributionStatistics(combined),
    averageAbsoluteDifference: average(absoluteDifferences),
    maximumAbsoluteDifference: maximum(absoluteDifferences),
    averageSymmetricDifferencePercent: average(symmetricDifferences),
    maximumSymmetricDifferencePercent: maximum(symmetricDifferences),
    averagePreloadVariationPercent: average(preloadVariations),
    maximumPreloadVariationPercent: maximum(preloadVariations),
    combinedWithinTargetPercent: combined.length ? withinTarget / combined.length * 100 : Number.NaN,
    unit: baseline.unit,
  };
}

function distributionStatistics(values: number[]): DistributionStatistics {
  const mean = average(values);
  return {
    count: values.length,
    minimum: values.length ? Math.min(...values) : Number.NaN,
    average: mean,
    maximum: maximum(values),
    standardDeviation: values.length
      ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
      : Number.NaN,
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
}

function maximum(values: number[]): number {
  return values.length ? Math.max(...values) : Number.NaN;
}

function renderSelectedOutput(targetId: string, result: RegressionResult, context: string): void {
  byId(targetId).innerHTML = `
    <div><span>${escapeHtml(regressionLabels[selectedRegression])}</span><strong>${escapeHtml(context)}</strong></div>
    <div><span>Torque intercept</span><strong>${format(calculateTorqueIntercept(result), 3)} ft-lb</strong></div>
    <div><span>Slope</span><strong>${format(reportSlope(result.slope), 3)} ft-lb/in</strong></div>
    <div><span>Shim pack</span><strong>${format(result.shimValue, 5)} ${escapeHtml(result.shimUnit)}</strong></div>`;
}

function renderRegressionSummary(results: Record<RegressionKey, RegressionResult>, chosenFit = ""): string {
  return `<div class="table-heading"><h3>All regressions</h3><span>Stored fit errors are evaluated in-window</span></div>
    <div class="table-wrap"><table class="summary-table">
      <thead><tr><th>Regression</th><th>Window</th><th>Torque intercept</th><th>Slope (ft-lb/in)</th><th>Shim pack</th><th>R²</th><th>Avg error</th><th>Max error</th><th>Status</th></tr></thead>
      <tbody>${(Object.keys(regressionLabels) as RegressionKey[]).map((key) => {
        const result = results[key];
        const isHistoric = result.status !== undefined;
        const chosen = normalizeFit(chosenFit) === key;
        return `<tr class="${key === selectedRegression ? "focused-row" : ""}">
          <td><strong>${regressionLabels[key]}${chosen ? " · chosen" : ""}</strong></td>
          <td>${isHistoric ? `${result.start + 1}–${result.end + 1}` : `${result.start + 1}–${result.end + 1}`}</td>
          <td>${format(calculateTorqueIntercept(result), 3)}</td><td>${format(reportSlope(result.slope), 3)}</td>
          <td>${format(result.shimValue, 5)} ${escapeHtml(result.shimUnit)}</td>
          <td>${format(result.metrics.r2, 5)}</td><td>${format(result.metrics.averageError, 3)}</td><td>${format(result.metrics.maxError, 3)}</td>
          <td><span class="row-status ${(result.status ?? "proposed").toLowerCase() === "pass" ? "pass" : result.status ? "fail" : "proposed"}" title="${escapeHtml(result.rejectReason ?? "")}">${escapeHtml(result.status ?? "Proposed")}</span></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
}

function renderErrorTable(result: RegressionResult, title: string): string {
  return `<div class="table-heading"><h3>${escapeHtml(title)}</h3><span>Residual = measured − predicted torque</span></div>
    <div class="table-wrap error-table-wrap"><table class="error-table">
      <thead><tr><th>Point</th><th>Fit?</th><th>Shim-space X</th><th>Measured</th><th>Predicted</th><th>Residual</th><th>|Error|</th></tr></thead>
      <tbody>${result.errors.map((error, index) => `<tr class="${error.included ? "included-error" : ""}">
        <td>${index + 1}</td><td>${error.included ? "Yes" : "No"}</td><td>${format(error.x, 5)}</td><td>${format(error.y, 2)}</td>
        <td>${format(error.predicted, 3)}</td><td class="${error.residual < 0 ? "negative" : "positive"}">${format(error.residual, 3)}</td><td>${format(error.absoluteError, 3)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}

function normalizeFit(value: string): RegressionKey | undefined {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  if (normalized === "set1") return "set1";
  if (normalized === "set2") return "set2";
  if (normalized === "combined") return "combined";
  return undefined;
}

function calculateTorqueIntercept(result: RegressionResult): number | undefined {
  if (result.shimValue === undefined || !Number.isFinite(result.shimValue)) return undefined;
  const torque = result.slope * result.shimValue + result.intercept;
  return Number.isFinite(torque) ? torque : undefined;
}

function reportSlope(slopeInActiveDistanceUnit: number): number {
  return selectedUnitSystem === "metric" ? slopeInActiveDistanceUnit * 25.4 : slopeInActiveDistanceUnit;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function renderSafely(): void {
  try {
    render();
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown rendering error";
    byId("cluster-message").classList.add("error");
    byId("cluster-message").innerHTML = `<strong>Unable to update the report</strong><span>${escapeHtml(message)}</span>`;
  }
}

byId<HTMLSelectElement>("run-select").addEventListener("change", (event) => {
  selectedRunId = (event.currentTarget as HTMLSelectElement).value;
  plotScope = "run";
  renderSafely();
});
byId<HTMLSelectElement>("model-select").addEventListener("change", (event) => {
  selectedModel = (event.currentTarget as HTMLSelectElement).value;
  selectedRunId = "";
  plotScope = "cluster";
  renderSafely();
});
byId("unit-toggle").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-unit-system]");
  if (!button) return;
  selectedUnitSystem = button.dataset.unitSystem as UnitSystem;
  renderSafely();
});
byId("regression-tabs").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-regression]");
  if (!button) return;
  selectedRegression = button.dataset.regression as RegressionKey;
  renderSafely();
});
byId("cluster-message").addEventListener("click", (event) => {
  const clusterButton = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-plot-cluster]");
  if (clusterButton) {
    plotScope = "cluster";
    renderSafely();
    return;
  }
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-record-filter]");
  if (!button) return;
  if (excludedRunIds.has(selectedRunId)) excludedRunIds.delete(selectedRunId);
  else excludedRunIds.add(selectedRunId);
  renderSafely();
});

renderSafely();
