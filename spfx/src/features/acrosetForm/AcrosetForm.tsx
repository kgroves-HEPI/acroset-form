/**
 * File Name: AcrosetForm.tsx
 * Project: Acroset
 * Description: Main React form for collecting Acroset inputs, running calculations, exporting CSVs, and saving SharePoint records.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import * as React from "react";
import { Guid } from "@microsoft/sp-core-library";

import styles from "./AcrosetForm.module.scss";
import {
  compute,
  CalcResult,
  ComputeInput,
  FitStats,
  Group,
  PointRow,
  Unit,
} from "./calculation/compute";
import {
  defaultCalculationThresholds,
  decimalsByUnit,
  MEASUREMENTS_FOLDER,
  pairDeviationMaxByUnit,
  RESULTS_FOLDER,
  resultToleranceLabelByUnit,
  retainerInputLabelByUnit,
} from "./config/runtimeConfig";
import {
  frontModels,
  groupOptions,
  locationOptions,
  preloadLookup,
  rearModels,
  retainerLookup,
  torqueArrayLookup,
  unitOptions,
} from "./data/lookups";
import { buildMeasurementsCsv, buildResultsCsv } from "./services/csvExport";
import { uploadCsvToFolder } from "./services/sharePointStorage";
import type { FormState, ModelSpec, Row, RowMeasurement } from "./types";
import {
  buildMonotonicFlags,
  formatValueByUnit,
  isNonIncreasing,
  isWithinPairDeviation,
  parseNonNegativeNumber,
  pickValueByUnit,
} from "./validation/measurementValidation";
import {
  RetainerValidationResult,
  validateRetainerMeasurement,
} from "./validation/retainerValidation";
import { getSP } from "../../platform/sharepoint/pnpjsClient";

interface AcrosetFormProps {
  listTitle: string;
  isLocalWorkbench?: boolean;
}

export default function AcrosetForm({
  listTitle,
  isLocalWorkbench = false,
}: AcrosetFormProps): JSX.Element {
  // Result and status state used to drive the messages shown under the form.
  const [calcResult, setCalcResult] = React.useState<CalcResult | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  // Each measurement set is validated and locked independently.
  const [set1Status, setSet1Status] = React.useState<string | null>(null);
  const [set2Status, setSet2Status] = React.useState<string | null>(null);
  const [set1Locked, setSet1Locked] = React.useState<boolean>(false);
  const [set2Locked, setSet2Locked] = React.useState<boolean>(false);

  // Tracks whether each row was completed and blurred so we only lock a set
  // after the user has actually finished entering every row.
  const [set1Blurred, setSet1Blurred] = React.useState<boolean[]>([]);
  const [set2Blurred, setSet2Blurred] = React.useState<boolean[]>([]);

  // Per-row monotonic checks let the UI show red/green feedback as data is typed.
  const [monoOkSet1, setMonoOkSet1] = React.useState<boolean[]>([]);
  const [monoOkSet2, setMonoOkSet2] = React.useState<boolean[]>([]);

  const [saving, setSaving] = React.useState(false);
  const todayYmd = new Date().toISOString().slice(0, 10);

  // Stores the retainer "good / warn / error" message shown near the input.
  const [retainerCheck, setRetainerCheck] =
    React.useState<RetainerValidationResult>({
      status: "unknown",
      msg: "",
    });

  const [form, setForm] = React.useState<FormState>({
    date: todayYmd,
    mechanic: "",
    wo: "",
    location: "",
    unit: unitOptions[0] ?? "Imperial",
    group: "",
    modelKey: "",
    retainerMeasured: "",
    rows: [],
  });

  // Look up the chosen model so the rest of the form can pull the correct
  // preload, retainer, and torque-array values from the JSON lookup tables.
  const modelSpec: ModelSpec | null = React.useMemo(() => {
    if (!form.group || !form.modelKey) return null;
    const isFront = (form.group || "").toLowerCase() === "front";
    const modelLookup = isFront ? frontModels : rearModels;
    return modelLookup[form.modelKey] ?? null;
  }, [form.group, form.modelKey]);

  // Re-run the quick retainer sanity check whenever the user changes the value,
  // the unit system, or the selected model.
  React.useEffect(() => {
    const retainerKey = modelSpec?.retainer;
    setRetainerCheck(
      validateRetainerMeasurement(
        form.retainerMeasured,
        retainerLookup,
        retainerKey,
        form.unit
      )
    );
  }, [form.retainerMeasured, form.unit, modelSpec?.retainer]);

  // Pull the torque points for the chosen model. These torque values determine
  // how many measurement rows the table should show.
  const torqueArray: number[] = React.useMemo<number[]>(() => {
    if (!modelSpec) return [];
    const key = modelSpec.TorqueArray;
    return torqueArrayLookup[key] ?? [];
  }, [modelSpec]);

  // Used as the input placeholder so the mechanic can see the expected nominal value.
  const nominalRetainerPlaceholder = React.useMemo<string>(() => {
    if (!modelSpec) return "";
    const retainer = retainerLookup[modelSpec.retainer];
    if (!retainer) return "";
    return formatValueByUnit(form.unit, pickValueByUnit(form.unit, retainer));
  }, [modelSpec, form.unit]);

  // Preload is calculated from lookup data, not typed by the user.
  const preloadValue = React.useMemo<number>(() => {
    if (!modelSpec) return 0;
    const preload = preloadLookup[modelSpec.preload];
    return preload ? pickValueByUnit(form.unit, preload) : 0;
  }, [modelSpec, form.unit]);

  // Reset the measurement grid whenever the selected model changes to one with a
  // different torque profile.
  React.useEffect((): void => {
    const newRows: Row[] = torqueArray.map((t) => ({
      torque_ftlb: t,
      s1_m1: "",
      s1_m2: "",
      s2_m1: "",
      s2_m2: "",
    }));
    setForm((prev) => ({ ...prev, rows: newRows }));
    setSet1Blurred(torqueArray.map(() => false));
    setSet2Blurred(torqueArray.map(() => false));
    setSet1Locked(false);
    setSet2Locked(false);
    setSet1Status(null);
    setSet2Status(null);
    setCalcResult(null);
    setStatus(null);
  }, [torqueArray]);

  // --- UI change handlers ---
  const onChangeText = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onChangeSelect = (
    e: React.ChangeEvent<HTMLSelectElement>,
    kind: "unit" | "group" | "model" | "location"
  ): void => {
    const { value } = e.target;
    if (kind === "unit") {
      setForm((prev) => ({
        ...prev,
        unit: value as Unit,
        retainerMeasured: prev.retainerMeasured,
      }));
      setCalcResult(null);
      setStatus(null);
      return;
    }
    if (kind === "group") {
      setForm((prev) => ({
        ...prev,
        group: value as Group,
        modelKey: "",
        rows: [],
      }));
      return;
    }
    if (kind === "model") {
      setForm((prev) => ({ ...prev, modelKey: value }));
      return;
    }
    if (kind === "location") {
      setForm((prev) => ({ ...prev, location: value }));
    }
  };

  const onChangeNumberCell = (
    e: React.ChangeEvent<HTMLInputElement>,
    rowIdx: number,
    field: "s1_m1" | "s1_m2" | "s2_m1" | "s2_m2"
  ): void => {
    const { value } = e.target;
    const valid = /^\d*\.?\d*$/.test(value);
    if (!valid && value !== "") return;

    setForm((prev) => {
      const rows = [...prev.rows];
      rows[rowIdx] = { ...rows[rowIdx], [field]: value };
      return { ...prev, rows };
    });
  };

  const onBlurNumberCell = (
    e: React.FocusEvent<HTMLInputElement>,
    rowIdx: number,
    setNum: 1 | 2
  ): void => {
    const { name, value } = e.target;
    const n = parseFloat(value);
    const dec = decimalsByUnit[form.unit];
    if (isNaN(n) || n < 0) return;

    const field = name.split(".").pop() as
      | "s1_m1"
      | "s1_m2"
      | "s2_m1"
      | "s2_m2";

    // Use a copied snapshot so the formatting and validation logic all refer to
    // the same row values during this blur event.
    const nextRows = [...form.rows];
    const formatted = n.toFixed(dec);
    nextRows[rowIdx] = { ...nextRows[rowIdx], [field]: formatted };

    // Save the formatted value first so the UI shows the standardized precision.
    setForm((prev) => ({ ...prev, rows: nextRows }));

    // After the save, update the row-complete flags and the per-row monotonic
    // indicators using the same snapshot to avoid stale state reads.
    Promise.resolve().then(() => {
      // Mark this row as "completed" only once both measurements in the pair exist.
      if (setNum === 1) {
        const r = nextRows[rowIdx];
        const bothFilled = r.s1_m1 !== "" && r.s1_m2 !== "";
        if (bothFilled) {
          setSet1Blurred((prev) => {
            if (prev[rowIdx]) return prev; // already true; no churn
            const next = [...prev];
            next[rowIdx] = true;
            return next;
          });
        }
      } else {
        const r = nextRows[rowIdx];
        const bothFilled = r.s2_m1 !== "" && r.s2_m2 !== "";
        if (bothFilled) {
          setSet2Blurred((prev) => {
            if (prev[rowIdx]) return prev; // already true; no churn
            const next = [...prev];
            next[rowIdx] = true;
            return next;
          });
        }
      }

      // Recalculate red/green borders for the full set after each edit.
      const avgs1 = nextRows.map((r) => {
        const v1 = parseFloat(r.s1_m1);
        const v2 = parseFloat(r.s1_m2);
        return !isNaN(v1) && !isNaN(v2) ? (v1 + v2) / 2 : undefined;
      });
      const avgs2 = nextRows.map((r) => {
        const v1 = parseFloat(r.s2_m1);
        const v2 = parseFloat(r.s2_m2);
        return !isNaN(v1) && !isNaN(v2) ? (v1 + v2) / 2 : undefined;
      });

      setMonoOkSet1(buildMonotonicFlags(avgs1));
      setMonoOkSet2(buildMonotonicFlags(avgs2));
    });
  };

  const onBlurRetainer = (e: React.FocusEvent<HTMLInputElement>): void => {
    const n = parseFloat(e.target.value);
    const dec = decimalsByUnit[form.unit];
    if (!isNaN(n) && n >= 0) {
      setForm((prev) => ({ ...prev, retainerMeasured: n.toFixed(dec) }));
    }
  };

  // --- Validation helpers used by the table and submit flow ---
  function withinPairDeviation(v1: number, v2: number): boolean {
    return isWithinPairDeviation(form.unit, v1, v2);
  }
  function inputBorderClass(
    v1s: string,
    v2s: string,
    locked: boolean,
    idx: number,
    setNum: 1 | 2
  ): string {
    if (locked) return "";

    const v1 = parseFloat(v1s);
    const v2 = parseFloat(v2s);
    if (isNaN(v1) || isNaN(v2) || v1 < 0 || v2 < 0) return "";

    const pairOk = withinPairDeviation(v1, v2);
    const monoOk = setNum === 1 ? monoOkSet1[idx] : monoOkSet2[idx];

    return pairOk && monoOk ? styles.inputValid : styles.inputInvalid;
  }

  // Set 2 stays blocked until Set 1 is complete and valid. This matches the
  // current shop-floor workflow captured in the prototype.
  const set1Valid = React.useMemo<boolean>(() => {
    if (!form.rows.length) return false;
    const avgs: number[] = [];
    for (const r of form.rows) {
      const v1 = parseNonNegativeNumber(r.s1_m1);
      const v2 = parseNonNegativeNumber(r.s1_m2);
      if (v1 === undefined || v2 === undefined) return false;
      if (!withinPairDeviation(v1, v2)) return false;
      avgs.push((v1 + v2) / 2);
    }
    return isNonIncreasing(avgs);
  }, [form.rows, form.unit]);

  const set2Valid = React.useMemo<boolean>(() => {
    if (!set1Valid) return false;
    const avgs: number[] = [];
    for (const r of form.rows) {
      const v1 = parseNonNegativeNumber(r.s2_m1);
      const v2 = parseNonNegativeNumber(r.s2_m2);
      if (v1 === undefined || v2 === undefined) return false;
      if (!withinPairDeviation(v1, v2)) return false;
      avgs.push((v1 + v2) / 2);
    }
    return isNonIncreasing(avgs);
  }, [form.rows, set1Valid, form.unit]);

  // Locking prevents accidental edits after a set has passed validation.
  React.useEffect((): void => {
    if (set1Valid && set1Blurred.every(Boolean) && !set1Locked) {
      setSet1Status("✅ Set 1 inputs validated");
      setSet1Locked(true);
    }
  }, [set1Valid, set1Blurred, set1Locked]);

  React.useEffect((): void => {
    if (set2Valid && set2Blurred.every(Boolean) && !set2Locked) {
      setSet2Status("✅ Set 2 inputs validated");
      setSet2Locked(true);
    }
  }, [set2Valid, set2Blurred, set2Locked]);

  // Small wrappers keep the JSX easier to read later in the file.
  const handleTextChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ): void => onChangeText(e);
  const handleLocationChange: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ): void => onChangeSelect(e, "location");
  const handleUnitChange: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ): void => onChangeSelect(e, "unit");
  const handleGroupChange: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ): void => onChangeSelect(e, "group");
  const handleModelChange: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ): void => onChangeSelect(e, "model");

  const onChangeRetainer: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ): void => {
    const v = e.target.value;
    if (/^\d*\.?\d*$/.test(v) || v === "") {
      setForm((prev) => ({ ...prev, retainerMeasured: v }));
    }
  };

  function makeOnChangeCell(
    rowIdx: number,
    field: "s1_m1" | "s1_m2" | "s2_m1" | "s2_m2"
  ): React.ChangeEventHandler<HTMLInputElement> {
    return (e: React.ChangeEvent<HTMLInputElement>): void =>
      onChangeNumberCell(e, rowIdx, field);
  }

  function makeOnBlurCell(
    rowIdx: number,
    setNum: 1 | 2
  ): React.FocusEventHandler<HTMLInputElement> {
    return (e: React.FocusEvent<HTMLInputElement>): void =>
      onBlurNumberCell(e, rowIdx, setNum);
  }

  /**
   * Handles the full "Calculate & Submit" flow.
   *
   * Sequence:
   * 1. Re-check the retainer sanity rules
   * 2. Build the typed calculation input
   * 3. Run the regression engine
   * 4. Generate both CSV exports
   * 5. Upload the CSVs to SharePoint folders
   * 6. Save a SharePoint list item that links to those files
   */
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const shortGuid = Guid.newGuid().toString().slice(0, 4);
    // Run the simple retainer check one more time before saving anything.
    const current = validateRetainerMeasurement(
      form.retainerMeasured,
      retainerLookup,
      modelSpec?.retainer,
      form.unit
    );
    setRetainerCheck(current);

    if (current.status === "error") {
      setStatus("❌ " + current.msg);
      setSaving(false);
      return; // block calculation/save on red tier
    }
    // (optional) if you want a subtle heads-up on warn:
    if (current.status === "warn") {
      setStatus("⚠️ " + current.msg);
    }

    try {
      // Convert string inputs from the form into the typed shape expected by
      // the calculation engine.
      const rows: PointRow[] = form.rows.map((r) => ({
        torque_ftlb: r.torque_ftlb,
        s1_m1: parseNonNegativeNumber(r.s1_m1) ?? undefined,
        s1_m2: parseNonNegativeNumber(r.s1_m2) ?? undefined,
        s2_m1: parseNonNegativeNumber(r.s2_m1) ?? undefined,
        s2_m2: parseNonNegativeNumber(r.s2_m2) ?? undefined,
      }));
      const input: ComputeInput = {
        unit: form.unit,
        group: form.group as Group,
        modelKey: form.modelKey,
        torqueArray_ftlb: torqueArray,
        preload: preloadValue,
        retainerMeasured: parseFloat(form.retainerMeasured),
        rows,
        thresholds: {
          ...defaultCalculationThresholds,
          pairDevMax: pairDeviationMaxByUnit[form.unit],
        },
      };

      const result = compute(input);
      setCalcResult(result);
      setStatus(
        result.ok
          ? "✅ Calculation validated."
          : result.message ?? "❌ Calculation failed."
      );

      const ymdToIso = (ymd: string): string | null => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
        return new Date(`${ymd}T12:00:00Z`).toISOString();
      };

      const dateIso = form.date ? ymdToIso(form.date) : null;
      if (!dateIso) {
        setStatus("❌ Invalid date. Pick a valid date.");
        setSaving(false);
        return;
      }

      // This ID ties the SharePoint list item and both CSV files together.
      const run_id = `${form.wo}_${form.date}_${shortGuid}`;
      const date_iso_ui = form.date;
      const units: Unit = form.unit as Unit;
      const preload_ftlb =
        typeof input.preload === "number" ? input.preload : preloadValue;
      const retainer_measured_value = Number(form.retainerMeasured ?? 0);

      // Build both export files before the list item is saved so we can include
      // working file links in the SharePoint row.
      const resultsCsv = buildResultsCsv({
        run_id,
        date_iso: date_iso_ui,
        mechanic_name: form.mechanic,
        work_order: form.wo,
        location: form.location,
        units,
        group: form.group,
        model: form.modelKey,
        preload_ftlb,
        retainer_measured_value,
        result,
      });

      const measurementsCsv = buildMeasurementsCsv({
        run_id,
        rows: form.rows as RowMeasurement[],
        units,
      });

      // Upload the exports first. If an upload fails, we do not create the list item.
      const fileBase = `run_${run_id}`;
      const resultsName = `${fileBase}_results.csv`;
      const measurementsName = `${fileBase}_measurements.csv`;

      const { absUrl: resultsUrl } = await uploadCsvToFolder(
        RESULTS_FOLDER,
        resultsName,
        resultsCsv
      );
      const { absUrl: measurementsUrl } = await uploadCsvToFolder(
        MEASUREMENTS_FOLDER,
        measurementsName,
        measurementsCsv
      );

      // Save the summary row even when the calculation fails so operations still
      // have a record of the attempt and the raw measurement export.
      const payload: Record<string, any> = {
        Title: `${form.wo || "WO"}-${form.modelKey || "Model"}-${form.group}-${
          form.location
        }`,
        Date: dateIso,
        Mechanic: form.mechanic,
        Status: result.ok ? "Pass" : result.message ?? "Fail",
        ResultsCsvUrl: { Url: resultsUrl, Description: resultsName },
        MeasurementsCsvUrl: {
          Url: measurementsUrl,
          Description: measurementsName,
        },
      };

      await getSP().web.lists.getByTitle(listTitle).items.add(payload);
      setStatus("✅ Saved run and uploaded CSVs.");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Save failed: ${err?.message ?? err}`);
    }
  };

  // Derived values keep the JSX block below simpler to read.
  const modelOptions = React.useMemo<string[]>(() => {
    if (!form.group) return [];
    const modelLookup = form.group === "Front" ? frontModels : rearModels;
    return Object.keys(modelLookup);
  }, [form.group]);

  const unitMeasHdr = form.unit === "Imperial" ? "(in)" : "(mm)";
  const tolLabel = resultToleranceLabelByUnit[form.unit];

  function renderRow(r: Row, idx: number): JSX.Element {
    return (
      <tr key={r.torque_ftlb}>
        <td>{r.torque_ftlb}</td>

        {/* Set 1 must be completed first and locks once it passes validation. */}
        <td>
          <input
            className={`${styles.input} ${inputBorderClass(
              r.s1_m1,
              r.s1_m2,
              set1Locked,
              idx,
              1
            )}`}
            type="number"
            inputMode="decimal"
            name={`row.${idx}.s1_m1`}
            value={r.s1_m1}
            onChange={makeOnChangeCell(idx, "s1_m1")}
            onBlur={makeOnBlurCell(idx, 1)}
            disabled={set1Locked}
          />
        </td>
        <td>
          <input
            className={`${styles.input} ${inputBorderClass(
              r.s1_m1,
              r.s1_m2,
              set1Locked,
              idx,
              1
            )}`}
            type="number"
            inputMode="decimal"
            name={`row.${idx}.s1_m2`}
            value={r.s1_m2}
            onChange={makeOnChangeCell(idx, "s1_m2")}
            onBlur={makeOnBlurCell(idx, 1)}
            disabled={set1Locked}
          />
        </td>

        {/* Set 2 only unlocks after Set 1 is complete. */}
        <td>
          <input
            className={`${styles.input} ${inputBorderClass(
              r.s2_m1,
              r.s2_m2,
              set2Locked,
              idx,
              2
            )}`}
            type="number"
            inputMode="decimal"
            name={`row.${idx}.s2_m1`}
            value={r.s2_m1}
            onChange={makeOnChangeCell(idx, "s2_m1")}
            onBlur={makeOnBlurCell(idx, 2)}
            disabled={!set1Locked || set2Locked}
          />
        </td>
        <td>
          <input
            className={`${styles.input} ${inputBorderClass(
              r.s2_m1,
              r.s2_m2,
              set2Locked,
              idx,
              2
            )}`}
            type="number"
            inputMode="decimal"
            name={`row.${idx}.s2_m2`}
            value={r.s2_m2}
            onChange={makeOnChangeCell(idx, "s2_m2")}
            onBlur={makeOnBlurCell(idx, 2)}
            disabled={!set1Locked || set2Locked}
          />
        </td>
      </tr>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.h2}>Acroset — Request Form</h2>

      {isLocalWorkbench && (
        <div className={styles.notice} role="alert">
          This web part depends on SharePoint lists and document libraries, so
          it must be loaded from the SharePoint tenant workbench instead of the
          local workbench.
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Top section: run metadata and model selection. */}
        <div className={styles.gridFormRow}>
          <label className={styles.label}>
            Date
            <input
              type="date"
              value={form.date || ""} // "YYYY-MM-DD"
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={styles.input}
              required // optional, if you want to force a date
            />
          </label>

          <label className={styles.label}>
            Mechanic name
            <input
              className={styles.input}
              name="mechanic"
              placeholder="Name"
              required
              value={form.mechanic}
              onChange={handleTextChange}
            />
          </label>

          <label className={styles.label}>
            WO #
            <input
              className={styles.input}
              name="wo"
              placeholder="e.g., 12345"
              required
              value={form.wo}
              onChange={handleTextChange}
            />
          </label>

          <label className={styles.label}>
            Location
            <select
              className={styles.input}
              name="location"
              required
              value={form.location}
              onChange={handleLocationChange}
            >
              <option value="" disabled>
                Select…
              </option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Units
            <select
              className={styles.input}
              name="unit"
              value={form.unit}
              onChange={handleUnitChange}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Group
            <select
              className={styles.input}
              name="group"
              required
              value={form.group}
              onChange={handleGroupChange}
            >
              <option value="" disabled>
                Select…
              </option>
              {groupOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Model
            <select
              className={styles.input}
              name="modelKey"
              required
              value={form.modelKey}
              onChange={handleModelChange}
              disabled={!form.group}
            >
              <option value="" disabled>
                Select…
              </option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            {retainerInputLabelByUnit[form.unit]}
            <input
              name="retainerMeasured"
              type="number"
              inputMode="decimal"
              step={form.unit === "Imperial" ? "0.0001" : "0.01"} // keep your current precision
              placeholder={
                nominalRetainerPlaceholder
                  ? `e.g., ${nominalRetainerPlaceholder}`
                  : "required"
              }
              required
              value={form.retainerMeasured}
              onChange={onChangeRetainer}
              onBlur={onBlurRetainer}
              className={[
                styles.input,
                retainerCheck.status === "warn" ? styles.inputWarn : "",
                retainerCheck.status === "error" ? styles.inputError : "",
              ]
                .join(" ")
                .trim()}
              aria-invalid={retainerCheck.status === "error"}
            />
          </label>

          {retainerCheck.status !== "unknown" && (
            <small
              className={
                retainerCheck.status === "error"
                  ? styles.msgError
                  : retainerCheck.status === "warn"
                  ? styles.msgWarn
                  : styles.msgOk
              }
            >
              {retainerCheck.msg}
              {typeof retainerCheck.delta === "number" &&
                typeof retainerCheck.nominal === "number" && (
                  <>
                    {" "}
                    ( Δ ={" "}
                    {retainerCheck.delta.toFixed(
                      form.unit === "Imperial" ? 4 : 3
                    )}{" "}
                    {form.unit === "Imperial" ? "in" : "mm"}, nominal{" "}
                    {retainerCheck.nominal.toFixed(
                      form.unit === "Imperial" ? 4 : 3
                    )}{" "}
                    {form.unit === "Imperial" ? "in" : "mm"})
                  </>
                )}
            </small>
          )}
        </div>

        {/* Measurement grid generated from the selected model's torque array. */}
        <h3 className={styles.section}>Measurements</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th rowSpan={2}>Torque (ft-lb)</th>
                <th colSpan={2}>Set 1 {unitMeasHdr}</th>
                <th colSpan={2}>Set 2 {unitMeasHdr}</th>
              </tr>
              <tr>
                <th>Meas. #1</th>
                <th>Meas. #2</th>
                <th>Meas. #1</th>
                <th>Meas. #2</th>
              </tr>
            </thead>
            <tbody>{form.rows.map(renderRow)}</tbody>
          </table>
        </div>

        <div>
          {set1Status && <div className={styles.statusValid}>{set1Status}</div>}
          {set2Status && <div className={styles.statusValid}>{set2Status}</div>}
        </div>

        <button
          type="submit"
          className={styles.button}
          disabled={
            isLocalWorkbench ||
            saving || // ⬅ prevent double clicks
            !form.location ||
            !form.group ||
            !form.modelKey ||
            !form.retainerMeasured ||
            !set1Valid ||
            !set2Valid
          }
        >
          {saving ? "Saving…" : "Calculate & Submit"}
        </button>

        {status && (
          <div
            role="status"
            className={
              calcResult?.ok ? styles.statusValid : styles.statusInvalid
            }
          >
            {status}
          </div>
        )}

        {calcResult?.ok &&
          calcResult?.chosen &&
          (() => {
            const key = calcResult.chosen.toLowerCase() as
              | "set1"
              | "set2"
              | "combined";
            const fit = (calcResult as any)[key] as FitStats | undefined;
            if (!fit || typeof fit.shimX !== "number") return null;
            return (
              <div className={styles.results}>
                <h3>Shim Pack Recommendation</h3>
                <p>
                  {formatValueByUnit(form.unit, fit.shimX)} {tolLabel}
                </p>
              </div>
            );
          })()}
      </form>
    </div>
  );
}
