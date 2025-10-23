const rowsTbody = document.getElementById("rows");
const status = document.getElementById("status");
const primaryResult = document.getElementById("primaryResult");
const engInfo = document.getElementById("engInfo");

const modelOffsets = {
  "777 Front": 0.0051,
  "797 Front": 0.0098,
  "830E Front": 0.0059,
  "930E Front": 0.0106,
};

function parseNumber(v) {
  if (v === null || v === undefined) return null;
  const x = parseFloat(String(v).trim());
  return Number.isFinite(x) ? x : null;
}
function round(n, d = 6) {
  return Math.round(n * 10 ** d) / 10 ** d;
}
function markError(el, on) {
  if (!el) return;
  if (on) el.classList.add("error");
  else el.classList.remove("error");
}

function linearRegression(points) {
  // y = a*x + b
  const n = points.length;
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  let ssTot = 0,
    ssRes = 0;
  const yMean = sy / n;
  for (const p of points) {
    const yhat = a * p.x + b;
    ssTot += (p.y - yMean) ** 2;
    ssRes += (p.y - yhat) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const xInt = Math.abs(a) < 1e-12 ? null : -b / a;
  let absSum = 0,
    absMax = 0;
  for (const p of points) {
    const err = Math.abs(a * p.x + b - p.y);
    absSum += err;
    if (err > absMax) absMax = err;
  }
  const avgErr = absSum / n;
  return { a, b, r2, xInt, avgErr, maxErr: absMax };
}

function computeAll({ forSubmit = false } = {}) {
  status.innerHTML = "";
  const form = document.getElementById("appForm");
  const fd = new FormData(form);
  form
    .querySelectorAll("input,select")
    .forEach((el) => el.classList.remove("error"));

  const date = fd.get("date");
  const mechanic = fd.get("mechanic");
  const wo = fd.get("wo");
  const location = fd.get("location");
  const model = fd.get("model");
  const retainer = parseNumber(fd.get("retainer"));
  let valid = true;
  const errors = [];
// INPUT ERROR FLAGGING
  if (!date) {
    markError(form.querySelector('input[name="date"]'), true);
    valid = false;
    errors.push("Enter a Date.");
  }
  if (!mechanic) {
    markError(form.querySelector('input[name="mechanic"]'), true);
    valid = false;
    errors.push("Enter a Mechanic name.");
  }
  if (!wo) {
    markError(form.querySelector('input[name="wo"]'), true);
    valid = false;
    errors.push("Enter a WO#.");
  }
  if (!location) {
    markError(form.querySelector('select[name="location"]'), true);
    valid = false;
    errors.push("Select a Location.");
  }
  if (!model) {
    markError(form.querySelector('select[name="model"]'), true);
    valid = false;
    errors.push("Select a Model.");
  }
  if (retainer === null) {
    markError(form.querySelector('input[name="retainer"]'), true);
    valid = false;
    errors.push("Enter a valid Retainer thickness.");
  }

  const ptsAll = [];
  const ptsUsed = [];
  const rows = [];
  [...rowsTbody.querySelectorAll("tr")].forEach((tr, idx) => {
    const torque = parseNumber(tr.querySelector("input[data-torque]").value);
    const m1El = tr.querySelector(`input[name="m1-${idx}"]`);
    const m2El = tr.querySelector(`input[name="m2-${idx}"]`);
    const m1 = parseNumber(m1El.value);
    const m2 = parseNumber(m2El.value);
    let avg = null;
    if (m1 !== null && m2 !== null) avg = (m1 + m2) / 2;
    else if (m1 !== null) avg = m1;
    else if (m2 !== null) avg = m2;

    if (torque >= 40 && torque <= 140) {
      if (avg === null) {
        markError(m1El, true);
        markError(m2El, true);
        valid = false;
        errors.push("Provide Meas #1 or #2 for torque " + torque + ".");
      } else {
        markError(m1El, false);
        markError(m2El, false);
      }
    }

    const gap = avg !== null && retainer !== null ? avg - retainer : null;
    rows.push({ torque, m1, m2, avg, gap });
    if (gap !== null && torque !== null) {
      ptsAll.push({ x: gap, y: torque });
    }
    if (gap !== null && torque !== null && torque >= 40 && torque <= 140) {
      ptsUsed.push({ x: gap, y: torque });
    }
  });

  if (!valid) {
    status.innerHTML =
      '<div class="error-msg">Please correct the highlighted fields.<br><span class="muted">' +
      errors.join(" ") +
      "</span></div>";
    return { ok: false };
  }
  if (ptsUsed.length < 2) {
    status.innerHTML =
      '<div class="error-msg">Need at least two valid rows between 40–140 to run the fit.</div>';
    return { ok: false };
  }

  const fit = linearRegression(ptsUsed);
  if (!fit) {
    status.innerHTML =
      '<div class="error-msg">Unable to compute fit (degenerate data).</div>';
    return { ok: false };
  }
  if (fit.a > 0) {
    status.innerHTML =
      '<div class="error-msg">Invalid fit: slope is positive (' +
      round(fit.a, 6) +
      "). Trend must be negative.</div>";
    return { ok: false };
  }

  const modelOffset = modelOffsets[model] ?? 0;
  const xIntercept = fit.xInt;
  const shimX = xIntercept != null ? xIntercept - modelOffset : null;
  const yAtShim =
    shimX != null && isFinite(shimX) ? fit.a * shimX + fit.b : null;

  return {
    ok: true,
    meta: {
      date,
      mechanic,
      wo,
      location,
      model,
      retainer,
      emailTo: (fd.get("emailTo") || "").trim(),
      modelOffset,
    },
    rows,
    ptsAll,
    ptsUsed,
    fit,
    xIntercept,
    shimX,
    yAtShim,
  };
}
// CREATE CHART
function renderChart({ ptsAll, fit, shimX }) {
  const svg = document.getElementById("chart");
  const W = 900,
    H = 560,
    ml = 70,
    mr = 20,
    mt = 20,
    mb = 60;
  const innerW = W - ml - mr,
    innerH = H - mt - mb;
  const yMin = 0,
    yMax = 140;

  const xs = ptsAll.map((p) => p.x);
  if (fit && fit.xInt != null) xs.push(fit.xInt);
  if (shimX != null) xs.push(shimX);
  let xMin = xs.length ? Math.min(...xs) : 0;
  let xMax = xs.length ? Math.max(...xs) : 1;
  const pad = (xMax - xMin) * 0.08 || 0.08;
  xMin -= pad;
  xMax += pad;

  const sx = (x) => ml + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y) => H - mb - ((y - yMin) / (yMax - yMin)) * innerH;

  svg.innerHTML = "";

  const bg = document.createElementNS(svg.namespaceURI, "rect");
  bg.setAttribute("x", 0);
  bg.setAttribute("y", 0);
  bg.setAttribute("width", W);
  bg.setAttribute("height", H);
  bg.setAttribute("fill", "#fff");
  svg.appendChild(bg);

  for (let y = 0; y <= yMax; y += 20) {
    const ly = sy(y);
    const gl = document.createElementNS(svg.namespaceURI, "line");
    gl.setAttribute("x1", ml);
    gl.setAttribute("x2", W - mr);
    gl.setAttribute("y1", ly);
    gl.setAttribute("y2", ly);
    gl.setAttribute("stroke", "#e5e7eb");
    svg.appendChild(gl);
    const t = document.createElementNS(svg.namespaceURI, "text");
    t.setAttribute("x", ml - 8);
    t.setAttribute("y", ly + 4);
    t.setAttribute("text-anchor", "end");
    t.setAttribute("font-size", "11");
    t.setAttribute("fill", "#374151");
    t.textContent = y;
    svg.appendChild(t);
  }

  const xBase = sy(0);
  const xAxis = document.createElementNS(svg.namespaceURI, "line");
  xAxis.setAttribute("x1", ml);
  xAxis.setAttribute("x2", W - mr);
  xAxis.setAttribute("y1", xBase);
  xAxis.setAttribute("y2", xBase);
  xAxis.setAttribute("stroke", "#111827");
  svg.appendChild(xAxis);

  const ticks = 7;
  for (let i = 0; i <= ticks; i++) {
    const xv = xMin + (i / ticks) * (xMax - xMin);
    const xt = document.createElementNS(svg.namespaceURI, "line");
    xt.setAttribute("x1", sx(xv));
    xt.setAttribute("x2", sx(xv));
    xt.setAttribute("y1", xBase);
    xt.setAttribute("y2", xBase + 6);
    xt.setAttribute("stroke", "#111827");
    svg.appendChild(xt);
    const tx = document.createElementNS(svg.namespaceURI, "text");
    tx.setAttribute("x", sx(xv));
    tx.setAttribute("y", xBase + 20);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-size", "11");
    tx.setAttribute("fill", "#374151");
    tx.textContent = (Math.abs(xv) >= 1 ? xv.toFixed(3) : xv.toFixed(4))
      .replace(/\.0+$/, "")
      .replace(/\.$/, "");
    svg.appendChild(tx);
  }

  const xlabel = document.createElementNS(svg.namespaceURI, "text");
  xlabel.setAttribute("x", ml + innerW / 2);
  xlabel.setAttribute("y", H - 10);
  xlabel.setAttribute("text-anchor", "middle");
  xlabel.setAttribute("font-size", "12");
  xlabel.setAttribute("fill", "#111827");
  xlabel.textContent = "Gap (in)";
  svg.appendChild(xlabel);
  const ylabel = document.createElementNS(svg.namespaceURI, "text");
  ylabel.setAttribute("transform", "rotate(-90)");
  ylabel.setAttribute("x", -(mt + innerH / 2));
  ylabel.setAttribute("y", 18);
  ylabel.setAttribute("text-anchor", "middle");
  ylabel.setAttribute("font-size", "12");
  ylabel.setAttribute("fill", "#111827");
  ylabel.textContent = "Torque (ft-lb)";
  svg.appendChild(ylabel);

  for (const p of ptsAll) {
    const c = document.createElementNS(svg.namespaceURI, "circle");
    c.setAttribute("cx", sx(p.x));
    c.setAttribute("cy", sy(p.y));
    c.setAttribute("r", 4);
    c.setAttribute("fill", "#2563eb");
    c.setAttribute("opacity", "0.9");
    svg.appendChild(c);
  }

  if (fit) {
    const yA = yMax;
    const xA = (yA - fit.b) / fit.a;
    const yB = 0;
    const xB = (yB - fit.b) / fit.a;
    const line = document.createElementNS(svg.namespaceURI, "line");
    line.setAttribute("x1", sx(xA));
    line.setAttribute("y1", sy(yA));
    line.setAttribute("x2", sx(xB));
    line.setAttribute("y2", sy(yB));
    line.setAttribute("stroke", "#1f2937");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  }

  if (shimX != null && isFinite(shimX)) {
    const sl = document.createElementNS(svg.namespaceURI, "line");
    sl.setAttribute("x1", sx(shimX));
    sl.setAttribute("x2", sx(shimX));
    sl.setAttribute("y1", sy(0));
    sl.setAttribute("y2", sy(yMax));
    sl.setAttribute("stroke", "#dc2626");
    sl.setAttribute("stroke-width", "2");
    sl.setAttribute("stroke-dasharray", "6,6");
    svg.appendChild(sl);
    const t = document.createElementNS(svg.namespaceURI, "text");
    t.setAttribute("x", sx(shimX) + 6);
    t.setAttribute("y", sy(yMax) - 6);
    t.setAttribute("class", "shim-label");
    t.setAttribute("fill", "#dc2626");
    t.textContent = "Shim Pack";
    svg.appendChild(t);
  }
}
// SHOW RESULTS
function showResults(state) {
  const shimMsg =
    state.shimX == null || !isFinite(state.shimX)
      ? "—"
      : (Math.round(state.shimX * 1000) / 1000).toFixed(3);
  primaryResult.textContent =
    "Recommended Shim Pack = " + shimMsg + " ± 0.001 inches";
  const fit = state.fit;
  const info = [
    "Slope (a) = " + round(fit.a, 6),
    "R\u00B2 = " + round(fit.r2, 6),
    "Average error = " + round(fit.avgErr, 6),
    "Max error = " + round(fit.maxErr, 6),
    "Torque at Shim Pack (ft-lb) = " +
      (state.yAtShim == null ? "—" : round(state.yAtShim, 4)),
  ];
  engInfo.innerHTML = info.join(" &nbsp;&nbsp;|&nbsp;&nbsp; ");
}

function calculate() {
  const state = computeAll();
  if (!state.ok) return;
  renderChart({ ptsAll: state.ptsAll, fit: state.fit, shimX: state.shimX });
  showResults(state);
  status.innerHTML = '<div class="ok-msg">Calculation complete.</div>';
  return state;
}
// CREATE CSV FILE
function submitAll() {
  const state = computeAll({ forSubmit: true });
  if (!state.ok) return;

  const lines = [];
  const meta = state.meta;
  lines.push("Date," + JSON.stringify(meta.date));
  lines.push("Mechanic," + JSON.stringify(meta.mechanic));
  lines.push("WO#," + JSON.stringify(meta.wo));
  lines.push("Location," + JSON.stringify(meta.location));
  lines.push("Model," + JSON.stringify(meta.model));
  lines.push("Retainer (in)," + meta.retainer);
  lines.push("Model Offset (in)," + meta.modelOffset);
  lines.push("Slope (a)," + state.fit.a);
  lines.push("Intercept (b)," + state.fit.b);
  lines.push("R^2," + state.fit.r2);
  lines.push(
    "X-Intercept (in)," + (state.xIntercept == null ? "" : state.xIntercept)
  );
  lines.push("Shim Pack (in)," + (state.shimX == null ? "" : state.shimX));
  lines.push(
    "Torque at Shim Pack (ft-lb)," +
      (state.yAtShim == null ? "" : state.yAtShim)
  );
  lines.push("Average error (ft-lb)," + state.fit.avgErr);
  lines.push("Max error (ft-lb)," + state.fit.maxErr);
  lines.push("");
  lines.push(
    "Torque (ft-lb),Meas1 (in),Meas2 (in),Avg (in),Gap = Avg-Ret (in),Used in OLS (40–140)"
  );
  for (const r of state.rows) {
    const used =
      r.torque >= 40 && r.torque <= 140 && r.avg != null ? "yes" : "no";
    lines.push(
      [r.torque, r.m1 ?? "", r.m2 ?? "", r.avg ?? "", r.gap ?? "", used].join(
        ","
      )
    );
  }
  const csv = lines.join("\r\n");

  const fname = "acroset_wo" + meta.wo + "_" + (meta.date || "today") + ".csv";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);

  const to = encodeURIComponent(meta.emailTo || "");
  const subject = encodeURIComponent(
    "Acroset Report — WO# " + meta.wo + " — " + (meta.date || "")
  );
  const body = encodeURIComponent(
    "Recommended Shim Pack: " +
      (state.shimX == null
        ? "—"
        : (Math.round(state.shimX * 1000) / 1000).toFixed(3)) +
      " ± 0.001 in\n" +
      "Model: " +
      meta.model +
      " (offset " +
      meta.modelOffset +
      ")\n" +
      "Slope a: " +
      round(state.fit.a, 6) +
      ", R^2: " +
      round(state.fit.r2, 6) +
      ", Avg err: " +
      round(state.fit.avgErr, 6) +
      ", Max err: " +
      round(state.fit.maxErr, 6) +
      "\n\n" +
      "Please attach the downloaded CSV to this email."
  );
  if (meta.emailTo) {
    window.location.href =
      "mailto:" + to + "?subject=" + subject + "&body=" + body;
    status.innerHTML =
      '<div class="ok-msg">CSV downloaded. Email draft opened.</div>';
  } else {
    status.innerHTML =
      '<div class="ok-msg">CSV downloaded. Enter an email to auto-open a draft, or attach the CSV manually.</div>';
  }

  renderChart({ ptsAll: state.ptsAll, fit: state.fit, shimX: state.shimX });
  showResults(state);
}

document.getElementById("calcBtn").addEventListener("click", calculate);
document.getElementById("submitBtn").addEventListener("click", submitAll);
document.getElementById("resetBtn").addEventListener("click", () => {
  status.textContent = "";
  primaryResult.textContent = "";
  engInfo.textContent = "";
  document.getElementById("chart").innerHTML = "";
});
