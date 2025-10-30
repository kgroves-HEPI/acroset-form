// ---------- Utilities ----------
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const $ = (sel, root = document) => root.querySelector(sel);

function escapeCSV(v) {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function showStatus(msg, type = "error") {
  const el =
    $("#status") ||
    (() => {
      const d = document.createElement("div");
      d.id = "status";
      (document.body || document.documentElement).appendChild(d);
      return d;
    })();
  el.className = `small ${type === "ok" ? "ok-msg" : "error-msg"}`;
  el.textContent = msg;
}

function clearFieldErrors() {
  $$(".error").forEach((el) => el.classList.remove("error"));
  showStatus(""); // clear message
}

// ---------- On load ----------
document.addEventListener("DOMContentLoaded", () => {
  // 1) Auto-populate date (MM/DD/YYYY)
  const dateInput =
    $('#date, #inspectionDate, input[name="date"]') ||
    $('input[data-role="date"]');
  if (dateInput) {
    const t = new Date();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    const yyyy = t.getFullYear();
    dateInput.value = `${mm}/${dd}/${yyyy}`;
  }

  // 2) Remove "step" from table number inputs (per your request)
  $$('#rows input[type="number"]').forEach((inp) =>
    inp.removeAttribute("step")
  );

  // Flexible selectors (works no matter where the button lives)
  const saveBtn =
    $("#saveResults") ||
    $("#submitBtn") ||
    document.querySelector(".actions button.primary");

  const form =
    (saveBtn && saveBtn.closest("form")) || $("#data-form") || $("form");
  const rowsTbody = $("#rows") || (form && form.querySelector("#rows"));

  if (!saveBtn || !form || !rowsTbody) {
    // Fail soft with hints
    if (!saveBtn)
      showStatus('Save button not found (id="saveResults").', "error");
    if (!form) showStatus('Form not found (id="data-form").', "error");
    if (!rowsTbody) showStatus('Table body not found (id="rows").', "error");
    return;
  }
  // --- Limit table inputs to 4 decimal places ---
  document.querySelectorAll("#rows input[type='number']").forEach((input) => {
    input.addEventListener("input", () => {
      const val = input.value;
      if (val.includes(".")) {
        const [int, dec] = val.split(".");
        if (dec.length > 4) {
          input.value = `${int}.${dec.slice(0, 4)}`;
        }
      }
    });
  });

  // ---------- Validation ----------
  function validateAll() {
    clearFieldErrors();

    const errors = [];

    // A) ALL FIELDS REQUIRED
    //  - take all inputs/selects/textareas in the form
    //  - but skip the readonly torque inputs (first cell of each row)
    const tableInputs = $$("#rows input, #rows select, #rows textarea");
    const torqueInputs = $$(
      "#rows td:first-child input[readonly][data-torque]"
    );

    // Build a Set of elements to skip (readonly torque cells)
    const skipSet = new Set(torqueInputs);

    // Top section (not inside #rows)
    const topFields = $$(
      "#data-form input, #data-form select, #data-form textarea, form input, form select, form textarea"
    ).filter((el) => !rowsTbody.contains(el)); // exclude table fields

    // Validate top fields
    topFields.forEach((el) => {
      // Ignore buttons
      if (el.type === "button" || el.type === "submit" || el.type === "reset")
        return;

      // Radios: require one checked per name
      if (el.type === "radio") return; // we'll validate group once
      const required = true; // all fields required
      const val = (el.value ?? "").toString().trim();

      if (required && val === "") {
        el.classList.add("error");
        errors.push(`Please fill the "${el.name || el.id || "field"}" field.`);
      }
    });

    // Validate radio groups (if any)
    const radioNames = new Set(
      topFields.filter((el) => el.type === "radio").map((el) => el.name)
    );
    radioNames.forEach((name) => {
      const group = $$(`input[type="radio"][name="${CSS.escape(name)}"]`, form);
      if (!group.some((r) => r.checked)) {
        group.forEach((r) => r.classList.add("error"));
        errors.push(`Please select an option for "${name}".`);
      }
    });

    // Validate table fields (all measurement inputs must have a value)
    tableInputs.forEach((el) => {
      if (skipSet.has(el)) return; // don't require torque readonly cells
      const val = (el.value ?? "").toString().trim();
      if (val === "") {
        el.classList.add("error");
        errors.push("All measurement fields are required.");
      }
    });

    // B) MAX DEVIATION CHECK per row for torque 40–140 ft-lb
    const targetRows = $$("#rows tr");
    targetRows.forEach((tr) => {
      const inputs = $$("input", tr);
      if (!inputs.length) return;

      const torque = parseFloat(inputs[0].value); // first input = torque (readonly)
      if (!Number.isFinite(torque)) return;

      if (torque >= 40 && torque <= 140) {
        // remaining inputs are measurements (2 or 4 depending on your setup)
        const meas = inputs.slice(1).map((inp) => {
          const val = parseFloat((inp.value ?? "").toString().trim());
          return val;
        });

        // if any are NaN, mark as required (already handled), but also block deviation calc
        if (meas.some((v) => !Number.isFinite(v))) {
          return;
        }

        const max = Math.max(...meas);
        const min = Math.min(...meas);
        const deviation = max - min;

        if (deviation > 0.005 + 1e-12) {
          // mark this row's measurement inputs as error
          inputs.slice(1).forEach((inp) => inp.classList.add("error"));
          errors.push(
            `Row ${torque} ft-lb: deviation ${deviation.toFixed(
              4
            )} exceeds allowable variation. Check for typo or re-measure`
          );
        }
      }
    });

    if (errors.length) {
      // Focus first error and report
      const firstErr = $(".error");
      if (firstErr)
        firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
      showStatus(errors[0], "error"); // show the first error; keeps UI clean
      return false;
    }

    return true;
  }

  // ---------- CSV Export (unchanged except header updates) ----------
  function buildAndDownloadCSV() {
    const csvLines = [];

    // Meta/top section (everything not in #rows)
    const topFields = $$("input, select, textarea", form).filter(
      (el) =>
        !rowsTbody.contains(el) &&
        el.type !== "button" &&
        el.type !== "submit" &&
        el.type !== "reset"
    );

    // Build Field,Value section
    const kvPairs = [];
    topFields.forEach((el) => {
      if (el.type === "radio") {
        // only include checked radio
        if (!el.checked) return;
      }
      const key = el.getAttribute("data-label") || el.name || el.id || "field";
      let val = "";
      if (el.type === "checkbox") {
        val = el.checked ? "Yes" : "No";
      } else {
        val = (el.value ?? "").toString().trim();
      }
      kvPairs.push([key, val]);
    });

    if (kvPairs.length) {
      csvLines.push("Field,Value");
      kvPairs.forEach(([k, v]) =>
        csvLines.push(`${escapeCSV(k)},${escapeCSV(v)}`)
      );
    }

    if (kvPairs.length) csvLines.push(""); // spacer

    // Table section
    const rowEls = $$("#rows tr");
    if (rowEls.length) {
      // Build header from the first row inputs
      const firstInputs = $$("input", rowEls[0]);
      const hdr = firstInputs.map(
        (inp, i) =>
          inp.getAttribute("data-col-header") ||
          (i === 0 ? "Torque (ft-lb)" : inp.name || `Meas ${i}`)
      );
      csvLines.push(hdr.map(escapeCSV).join(","));

      // Build rows
      rowEls.forEach((tr) => {
        const vals = $$("input", tr).map((inp) =>
          (inp.value ?? "").toString().trim()
        );
        csvLines.push(vals.map(escapeCSV).join(","));
      });
    }

    const csvText = csvLines.join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // Filename with date if present
    const woInput = document.querySelector('input[name="wo"]');
    const woVal = (woInput?.value || "").trim().replace(/\s+/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Acroset_${woVal || "NoWO"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showStatus("CSV downloaded.", "ok");
  }

  // ---------- Wire up ----------
  saveBtn.addEventListener("click", () => {
    if (!validateAll()) return;
    buildAndDownloadCSV();
  });
});
