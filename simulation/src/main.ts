import "./styles.css";
import { exportCsv, parseMeasurementCsv } from "./csv";
import { currentRuleCandidate, generateCandidates } from "./regression";
import type { Bounds, Candidate, Dataset } from "./types";

const sample: Dataset = {
  id: "sample",
  runId: "SAMPLE-LINEAR-ENDS",
  name: "Built-in demonstration",
  setId: "Combined",
  unit: "in",
  points: [
    { torqueIndex: 1, x: 0.101, y: 0 },
    { torqueIndex: 2, x: 0.096, y: 20 },
    { torqueIndex: 3, x: 0.088, y: 40 },
    { torqueIndex: 4, x: 0.079, y: 60 },
    { torqueIndex: 5, x: 0.069, y: 80 },
    { torqueIndex: 6, x: 0.059, y: 100 },
    { torqueIndex: 7, x: 0.046, y: 120 },
  ],
};

let datasets: Dataset[] = [sample];
let selectedId = sample.id;
let candidates: Candidate[] = [];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="hero">
    <div>
      <p class="eyebrow">Engineering sandbox</p>
      <h1>Acroset Regression Lab</h1>
      <p class="lede">Compare every consecutive regression window against every measured point—without changing the SPFx application.</p>
    </div>
    <div class="hero-badge"><span id="dataset-count">1</span><small>datasets loaded</small></div>
  </header>
  <main>
    <section class="panel import-panel">
      <div>
        <p class="section-label">01 / Source data</p>
        <h2>Load measurement exports</h2>
        <p>Drop Acroset measurement CSVs here. Files remain in this browser and are not uploaded.</p>
      </div>
      <label class="drop-zone" id="drop-zone">
        <input id="file-input" type="file" accept=".csv,text/csv" multiple />
        <strong>Choose CSV files</strong>
        <span>or drag and drop up to your full historical folder</span>
      </label>
      <div id="import-message" class="message" aria-live="polite"></div>
    </section>

    <section class="workspace">
      <aside class="panel controls">
        <p class="section-label">02 / Experiment</p>
        <label>Dataset<select id="dataset-select"></select></label>
        <div class="dataset-meta" id="dataset-meta"></div>
        <label>Minimum consecutive points<input id="minimum-points" type="number" min="4" step="1" value="4" /></label>
        <div class="control-grid">
          <label>Minimum slope<input id="min-slope" type="number" placeholder="optional" /></label>
          <label>Target slope<input id="target-slope" type="number" placeholder="optional" /></label>
          <label>Maximum slope<input id="max-slope" type="number" placeholder="optional" /></label>
          <label>Reference X<input id="reference-x" type="number" step="any" placeholder="optional" /></label>
          <label>Minimum torque<input id="min-torque" type="number" placeholder="optional" /></label>
          <label>Target torque<input id="target-torque" type="number" placeholder="optional" /></label>
          <label>Maximum torque<input id="max-torque" type="number" placeholder="optional" /></label>
          <label>Maximum avg error<input id="max-average-error" type="number" min="0" value="5" /></label>
          <label>Maximum point error<input id="max-point-error" type="number" min="0" value="10" /></label>
        </div>
        <button id="download" class="button secondary">Export candidate CSV</button>
      </aside>

      <div class="results">
        <section class="panel chart-panel">
          <div class="section-heading">
            <div><p class="section-label">03 / Visual comparison</p><h2 id="chart-title">Regression view</h2></div>
            <div class="legend"><span class="dot included"></span>Selected window <span class="dot excluded"></span>Evaluated only</div>
          </div>
          <div id="chart" class="chart"></div>
          <div id="scorecards" class="scorecards"></div>
        </section>
        <section class="panel table-panel">
          <div class="section-heading">
            <div><p class="section-label">04 / All candidates</p><h2>Consecutive windows</h2></div>
            <p id="candidate-summary"></p>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Rank</th><th>Window</th><th>Points</th><th>Slope</th><th>All max</th><th>All avg</th><th>All R²</th><th>Window max</th><th>Status</th></tr></thead>
            <tbody id="candidate-table"></tbody>
          </table></div>
        </section>
      </div>
    </section>
  </main>
`;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const numericValue = (id: string): number | undefined => {
  const value = byId<HTMLInputElement>(id).value.trim();
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};
const format = (value: number | undefined, digits = 3): string =>
  value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);

function boundsFromControls(): Bounds {
  return {
    minSlope: numericValue("min-slope"),
    targetSlope: numericValue("target-slope"),
    maxSlope: numericValue("max-slope"),
    referenceX: numericValue("reference-x"),
    minReferenceTorque: numericValue("min-torque"),
    targetReferenceTorque: numericValue("target-torque"),
    maxReferenceTorque: numericValue("max-torque"),
    maxAverageError: numericValue("max-average-error"),
    maxPointError: numericValue("max-point-error"),
  };
}

function selectedDataset(): Dataset {
  return datasets.find((dataset) => dataset.id === selectedId) ?? datasets[0];
}

function render(): void {
  renderDatasetSelect();
  const dataset = selectedDataset();
  const minimumPoints = Math.max(4, Math.round(numericValue("minimum-points") ?? 4));
  byId<HTMLInputElement>("minimum-points").max = String(dataset.points.length);
  candidates = generateCandidates(dataset.points, minimumPoints, boundsFromControls());
  const best = candidates.find((candidate) => candidate.accepted) ?? candidates[0];
  const current = currentRuleCandidate(dataset.points);
  byId("dataset-count").textContent = String(datasets.length);
  byId("dataset-meta").innerHTML = `<strong>${escapeHtml(dataset.runId)}</strong><span>${dataset.setId} · ${dataset.points.length} points · ${escapeHtml(dataset.unit)}</span>`;
  byId("chart-title").textContent = `${dataset.runId} / ${dataset.setId}`;
  renderChart(dataset, best, current);
  renderCards(best, current);
  renderTable(best);
}

function renderDatasetSelect(): void {
  const select = byId<HTMLSelectElement>("dataset-select");
  const currentOptions = [...select.options].map((option) => option.value).join("|");
  const nextOptions = datasets.map((dataset) => dataset.id).join("|");
  if (currentOptions !== nextOptions) {
    select.innerHTML = datasets.map((dataset) =>
      `<option value="${escapeHtml(dataset.id)}">${escapeHtml(dataset.runId)} — ${dataset.setId}</option>`
    ).join("");
  }
  select.value = selectedId;
}

function renderChart(dataset: Dataset, best: Candidate | undefined, current: Candidate | undefined): void {
  if (!best) {
    byId("chart").innerHTML = `<div class="empty">Not enough points for the selected minimum.</div>`;
    return;
  }
  const width = 900;
  const height = 430;
  const padding = { left: 72, right: 26, top: 26, bottom: 54 };
  const xs = dataset.points.map((point) => point.x);
  const ys = dataset.points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = (xMax - xMin || 1) * 0.08;
  const yPad = (yMax - yMin || 1) * 0.1;
  const sx = (x: number) => padding.left + ((x - (xMin - xPad)) / (xMax - xMin + 2 * xPad)) * (width - padding.left - padding.right);
  const sy = (y: number) => height - padding.bottom - ((y - (yMin - yPad)) / (yMax - yMin + 2 * yPad)) * (height - padding.top - padding.bottom);
  const ticks = Array.from({ length: 6 }, (_, index) => index / 5);
  const line = (candidate: Candidate, className: string) => {
    const leftX = xMin - xPad;
    const rightX = xMax + xPad;
    return `<line class="${className}" x1="${sx(leftX)}" y1="${sy(candidate.slope * leftX + candidate.intercept)}" x2="${sx(rightX)}" y2="${sy(candidate.slope * rightX + candidate.intercept)}" />`;
  };
  const grid = ticks.map((tick) => {
    const y = yMin - yPad + tick * (yMax - yMin + 2 * yPad);
    return `<line class="grid" x1="${padding.left}" y1="${sy(y)}" x2="${width - padding.right}" y2="${sy(y)}"/><text class="axis-text" x="${padding.left - 12}" y="${sy(y) + 4}" text-anchor="end">${format(y, 0)}</text>`;
  }).join("");
  const points = dataset.points.map((point, index) => {
    const included = index >= best.start && index <= best.end;
    const errorY = best.slope * point.x + best.intercept;
    return `<line class="residual" x1="${sx(point.x)}" y1="${sy(point.y)}" x2="${sx(point.x)}" y2="${sy(errorY)}"/><circle class="point ${included ? "included" : "excluded"}" cx="${sx(point.x)}" cy="${sy(point.y)}" r="7"><title>Point ${index + 1}: x=${point.x}, torque=${point.y}</title></circle><text class="point-label" x="${sx(point.x)}" y="${sy(point.y) - 13}" text-anchor="middle">${index + 1}</text>`;
  }).join("");
  byId("chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Measured torque points and candidate regression lines">
    ${grid}
    ${current ? line(current, "current-line") : ""}
    ${line(best, "best-line")}
    ${points}
    <text class="axis-title" x="${width / 2}" y="${height - 10}" text-anchor="middle">Measurement (${escapeHtml(dataset.unit)})</text>
    <text class="axis-title" transform="translate(18 ${height / 2}) rotate(-90)" text-anchor="middle">Torque (ft-lb)</text>
  </svg>`;
}

function renderCards(best: Candidate | undefined, current: Candidate | undefined): void {
  if (!best) {
    byId("scorecards").innerHTML = "";
    return;
  }
  byId("scorecards").innerHTML = `
    <article><span>Selected window</span><strong>${best.start + 1}–${best.end + 1}</strong><small>${best.count} consecutive points</small></article>
    <article><span>Selected all-point max</span><strong>${format(best.all.maxError, 2)}</strong><small>ft-lb · every point scored</small></article>
    <article><span>Selected all-point avg</span><strong>${format(best.all.averageError, 2)}</strong><small>ft-lb</small></article>
    <article><span>Current-rule max</span><strong>${format(current?.all.maxError, 2)}</strong><small>${current ? `points ${current.start + 1}–${current.end + 1}` : "not available"}</small></article>`;
}

function renderTable(best: Candidate | undefined): void {
  const acceptedCount = candidates.filter((candidate) => candidate.accepted).length;
  byId("candidate-summary").textContent = `${acceptedCount} of ${candidates.length} candidates pass constraints`;
  byId("candidate-table").innerHTML = candidates.map((candidate, index) => `
    <tr class="${candidate === best ? "selected-row" : ""}">
      <td>${index + 1}</td><td>${candidate.start + 1}–${candidate.end + 1}</td><td>${candidate.count}</td>
      <td>${format(candidate.slope, 2)}</td><td>${format(candidate.all.maxError, 2)}</td>
      <td>${format(candidate.all.averageError, 2)}</td><td>${format(candidate.all.r2, 4)}</td>
      <td>${format(candidate.window.maxError, 2)}</td>
      <td><span class="status ${candidate.accepted ? "pass" : "fail"}" title="${escapeHtml(candidate.reasons.join(", "))}">${candidate.accepted ? "Pass" : "Reject"}</span></td>
    </tr>`).join("");
}

async function importFiles(files: File[]): Promise<void> {
  const csvFiles = files.filter((file) => file.name.toLowerCase().endsWith(".csv"));
  const imported: Dataset[] = [];
  const errors: string[] = [];
  await Promise.all(csvFiles.map(async (file) => {
    try {
      imported.push(...parseMeasurementCsv(file.name, await file.text()));
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "could not parse"}`);
    }
  }));
  if (imported.length) {
    datasets = imported;
    selectedId = imported[0].id;
  }
  const message = byId("import-message");
  message.className = `message ${errors.length ? "warning" : "success"}`;
  message.textContent = `${imported.length} datasets loaded from ${csvFiles.length} files${errors.length ? `; ${errors.length} files skipped` : ""}.`;
  if (errors.length) message.title = errors.join("\n");
  render();
}

function downloadResults(): void {
  const dataset = selectedDataset();
  const csv = exportCsv(candidates.map((candidate, index) => ({
    source_file: dataset.name,
    run_id: dataset.runId,
    set_id: dataset.setId,
    rank: index + 1,
    window_start: candidate.start + 1,
    window_end: candidate.end + 1,
    point_count: candidate.count,
    slope: candidate.slope,
    intercept: candidate.intercept,
    reference_torque: candidate.referenceTorque,
    window_max_error: candidate.window.maxError,
    window_average_error: candidate.window.averageError,
    window_r2: candidate.window.r2,
    all_max_error: candidate.all.maxError,
    all_average_error: candidate.all.averageError,
    all_rmse: candidate.all.rmse,
    all_r2: candidate.all.r2,
    accepted: candidate.accepted,
    rejection_reasons: candidate.reasons.join("; "),
  })));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `${dataset.runId}-${dataset.setId}-candidates.csv`.replace(/[^a-z0-9._-]/gi, "-");
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

byId<HTMLSelectElement>("dataset-select").addEventListener("change", (event) => {
  selectedId = (event.currentTarget as HTMLSelectElement).value;
  render();
});
document.querySelectorAll<HTMLInputElement>(".controls input").forEach((input) => input.addEventListener("input", render));
byId<HTMLInputElement>("file-input").addEventListener("change", (event) => void importFiles([...(event.currentTarget as HTMLInputElement).files ?? []]));
const dropZone = byId("drop-zone");
dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragging"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  void importFiles([...event.dataTransfer!.files]);
});
byId("download").addEventListener("click", downloadResults);
render();
