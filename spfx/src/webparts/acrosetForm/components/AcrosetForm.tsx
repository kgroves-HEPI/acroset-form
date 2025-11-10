import * as React from "react";
import styles from "./AcrosetForm.module.scss";
import {
  compute,
  CalcResult,
  ComputeInput,
  Unit,
  Group,
  PointRow,
} from "../../../utils/compute";

// --- data (adjust paths to match your project) ---
import modelFront from "../../../data/modelFrontList.json";
import modelRear from "../../../data/modelRearList.json";
import preloadList from "../../../data/preloadList.json";
import retainerList from "../../../data/retainerList.json";
import torqueArrayList from "../../../data/torqueArrayList.json";
import unitsList from "../../../data/unitsList.json";
import groupList from "../../../data/groupList.json";
import locationList from "../../../data/locationList.json";

// --- types matching your JSONs ---
type UnitValue = { in: number; mm: number };

type PreloadList = Record<string, UnitValue>;
type RetainerList = Record<string, UnitValue>;
type TorqueArrayList = Record<string, number[]>;

interface ModelSpec {
  group: Group;
  retainer: keyof RetainerList;
  preload: keyof PreloadList;
  TorqueArray: keyof TorqueArrayList;
}
type ModelMap = Record<string, ModelSpec>;

// --- helpers for units ---
const pairDevMaxByUnit: Record<Unit, number> = {
  Imperial: 0.01, // inches
  Metric: 0.25, // mm
};
const decimalsByUnit: Record<Unit, number> = { Imperial: 3, Metric: 2 };
const resultTolByUnit: Record<Unit, string> = {
  Imperial: "± 0.001 in",
  Metric: "± 0.03 mm",
};
const measLabelByUnit: Record<Unit, string> = {
  Imperial: "Measured Retainer Thickness (in)",
  Metric: "Measured Retainer Thickness (mm)",
};

function pickByUnit<T extends UnitValue>(u: Unit, val: T): number {
  return u === "Imperial" ? val.in : val.mm;
}

function formatByUnit(u: Unit, n: number): string {
  return n.toFixed(decimalsByUnit[u]);
}

function todayMMDDYYYY(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// --- row shape for dynamic torque arrays ---
type Row = {
  torque_ftlb: number;
  s1_m1: string;
  s1_m2: string;
  s2_m1: string;
  s2_m2: string;
};

type FormState = {
  date: string;
  mechanic: string;
  wo: string;
  location: string;
  unit: Unit;
  group: Group | "";
  modelKey: string;
  retainerMeasured: string; // in current unit (required)
  rows: Row[];
};

export default function AcrosetForm(): JSX.Element {
  // derive typed data
  const FRONT_MODELS = modelFront as unknown as ModelMap; // front
  const REAR_MODELS = modelRear as unknown as ModelMap; // rear
  const PRELOADS = preloadList as unknown as PreloadList;
  const RETAINERS = retainerList as unknown as RetainerList;
  const TORQUES = torqueArrayList as unknown as TorqueArrayList;
  const UNITS = unitsList as Unit[]; // ["Imperial","Metric"]
  const GROUPS = groupList as Group[]; // ["front","rear"]
  const LOCATIONS = locationList as string[];

  const [calcResult, setCalcResult] = React.useState<CalcResult | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const [set1Status, setSet1Status] = React.useState<string | null>(null);
  const [set2Status, setSet2Status] = React.useState<string | null>(null);
  const [set1Locked, setSet1Locked] = React.useState<boolean>(false);
  const [set2Locked, setSet2Locked] = React.useState<boolean>(false);

  // track "blurred" state per-row per set (to gate locking)
  const [set1Blurred, setSet1Blurred] = React.useState<boolean[]>([]);
  const [set2Blurred, setSet2Blurred] = React.useState<boolean[]>([]);

  const [monoOkSet1, setMonoOkSet1] = React.useState<boolean[]>([]);
  const [monoOkSet2, setMonoOkSet2] = React.useState<boolean[]>([]);

  

  const [form, setForm] = React.useState<FormState>({
    date: "",
    mechanic: "",
    wo: "",
    location: "",
    unit: UNITS[0] ?? "Imperial",
    group: "",
    modelKey: "",
    retainerMeasured: "",
    rows: [],
  });

  React.useEffect(() => {
  setForm((prev) => (prev.date ? prev : { ...prev, date: todayMMDDYYYY() }));
}, []);

  // derive model spec from group/modelKey
  const modelSpec: ModelSpec | null = React.useMemo<ModelSpec | null>(() => {
    if (!form.group || !form.modelKey) return null;
    const mm = form.group === "Front" ? FRONT_MODELS : REAR_MODELS;
    return (mm[form.modelKey] as ModelSpec) ?? null;
  }, [form.group, form.modelKey]);

  const torqueArray: number[] = React.useMemo<number[]>(() => {
    if (!modelSpec) return [];
    const key = modelSpec.TorqueArray;
    return TORQUES[key] ?? [];
  }, [modelSpec]);

  const nominalRetainerPlaceholder = React.useMemo<string>(() => {
    if (!modelSpec) return "";
    const r = RETAINERS[modelSpec.retainer];
    if (!r) return "";
    return formatByUnit(form.unit, pickByUnit(form.unit, r));
  }, [modelSpec, form.unit]);

  const preloadValue = React.useMemo<number>(() => {
    if (!modelSpec) return 0;
    const p = PRELOADS[modelSpec.preload];
    return p ? pickByUnit(form.unit, p) : 0;
  }, [modelSpec, form.unit]);

  // when torque array changes, re-initialize rows & blur tracking
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

  // --- UI change handlers (explicit return types) ---
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

    // ---- Build a nextRows snapshot with the formatted value
    const nextRows = [...form.rows];
    const formatted = n.toFixed(dec);
    nextRows[rowIdx] = { ...nextRows[rowIdx], [field]: formatted };

    // ---- 1) Commit the formatted value first
    setForm((prev) => ({ ...prev, rows: nextRows }));

    // ---- 2) After commit: mark row blurred only when its pair is complete,
    //        AND recompute monotonicity using the SAME nextRows snapshot.
    //        Use a microtask to ensure the UI paints the new value first.
    Promise.resolve().then(() => {
      // flip blurred for this row only when both cells for that set are filled
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

      // recompute per-row monotonicity flags from nextRows (no stale reads)
      const avgs1 = nextRows.map((r) => {
        const v1 = parseFloat(r.s1_m1);
        const v2 = parseFloat(r.s1_m2);
        return !isNaN(v1) && !isNaN(v2) ? (v1 + v2) / 2 : null;
      });
      const avgs2 = nextRows.map((r) => {
        const v1 = parseFloat(r.s2_m1);
        const v2 = parseFloat(r.s2_m2);
        return !isNaN(v1) && !isNaN(v2) ? (v1 + v2) / 2 : null;
      });

      const mono1 = avgs1.map((avg, i) =>
        i === 0 || avg === null || avgs1[i - 1] === null
          ? true
          : avg <= (avgs1[i - 1] as number)
      );
      const mono2 = avgs2.map((avg, i) =>
        i === 0 || avg === null || avgs2[i - 1] === null
          ? true
          : avg <= (avgs2[i - 1] as number)
      );

      setMonoOkSet1(mono1);
      setMonoOkSet2(mono2);
    });
  };

  const onBlurRetainer = (e: React.FocusEvent<HTMLInputElement>): void => {
    const n = parseFloat(e.target.value);
    const dec = decimalsByUnit[form.unit];
    if (!isNaN(n) && n >= 0) {
      setForm((prev) => ({ ...prev, retainerMeasured: n.toFixed(dec) }));
    }
  };

  // --- validation helpers (explicit return types) ---
  function withinPairDeviation(v1: number, v2: number): boolean {
    return Math.abs(v1 - v2) <= pairDevMaxByUnit[form.unit];
  }
  function nonIncreasing(avgs: number[]): boolean {
    for (let i = 1; i < avgs.length; i++) {
      if (avgs[i] > avgs[i - 1]) return false;
    }
    return true;
  }
  function parseNonNeg(s: string): number | null {
    const n = parseFloat(s);
    if (isNaN(n) || n < 0) return null;
    return n;
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

  // set-level validators (explicit return types)
  const set1Valid = React.useMemo<boolean>(() => {
    if (!form.rows.length) return false;
    const avgs: number[] = [];
    for (const r of form.rows) {
      const v1 = parseNonNeg(r.s1_m1);
      const v2 = parseNonNeg(r.s1_m2);
      if (v1 === null || v2 === null) return false;
      if (!withinPairDeviation(v1, v2)) return false;
      avgs.push((v1 + v2) / 2);
    }
    return nonIncreasing(avgs);
  }, [form.rows, form.unit]);

  const set2Valid = React.useMemo<boolean>(() => {
    if (!set1Valid) return false;
    const avgs: number[] = [];
    for (const r of form.rows) {
      const v1 = parseNonNeg(r.s2_m1);
      const v2 = parseNonNeg(r.s2_m2);
      if (v1 === null || v2 === null) return false;
      if (!withinPairDeviation(v1, v2)) return false;
      avgs.push((v1 + v2) / 2);
    }
    return nonIncreasing(avgs);
  }, [form.rows, set1Valid, form.unit]);

  // lock sets when valid + all blurred
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

  // ----- typed handler wrappers to avoid inline arrow functions -----
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

  // --- submit / calculate (explicit return types) ---
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    console.log("Form payload:", form);
    alert("Form captured locally. Check console for payload.");
  };

  const handleCalculate = (): void => {
    if (!modelSpec) return;

    // Build ComputeInput
    const rows: PointRow[] = form.rows.map((r) => ({
      torque_ftlb: r.torque_ftlb,
      s1_m1: parseNonNeg(r.s1_m1) ?? undefined,
      s1_m2: parseNonNeg(r.s1_m2) ?? undefined,
      s2_m1: parseNonNeg(r.s2_m1) ?? undefined,
      s2_m2: parseNonNeg(r.s2_m2) ?? undefined,
    }));

    const input: ComputeInput = {
      unit: form.unit,
      group: form.group as Group,
      modelKey: form.modelKey,
      torqueArray_ftlb: torqueArray,
      preload: preloadValue, // in current unit
      retainerMeasured: parseFloat(form.retainerMeasured), // in current unit
      rows,
      thresholds: {
        r2Min: 0.95,
        avgErrMax_ftlb: 5,
        maxErrMax_ftlb: 10,
        pairDevMax: pairDevMaxByUnit[form.unit],
        enforceMonotonic: true,
      },
    };

    const result = compute(input);

    // Always keep the full result so diagnostics can render
    setCalcResult(result);

    // Set a clear status message based on pass/fail
    setStatus(
      result.ok
        ? "✅ Calculation validated."
        : result.message ?? "❌ Calculation failed."
    );

    // No early return; the UI will now show:
    // - Shim Pack Recommendation (only when ok)
    // - Regression Diagnostics (always, when a result is present)

    //const result = compute(input);
    //if (!result.ok) {
    //setCalcResult(null);
    //setStatus(result.message ?? "❌ Calculation failed.");
    //return;
    //}
    //setCalcResult(result);
    //setStatus("✅ Calculation validated.");
  };

  // --- derived UI bits ---
  const modelOptions = React.useMemo<string[]>(() => {
    if (!form.group) return [];
    const mm = form.group === "Front" ? FRONT_MODELS : REAR_MODELS;
    return Object.keys(mm);
  }, [form.group]);

  const unitMeasHdr = form.unit === "Imperial" ? "(in)" : "(mm)";
  const tolLabel = resultTolByUnit[form.unit];

  function renderRow(r: Row, idx: number): JSX.Element {
    return (
      <tr key={r.torque_ftlb}>
        <td>{r.torque_ftlb}</td>

        {/* Set 1 */}
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

        {/* Set 2 */}
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

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Top row */}
        <div className={styles.gridFormRow}>
          <label className={styles.label}>
            Date
            <input
              className={styles.input}
              name="date"
              placeholder="MM/DD/YYYY"
              required
              value={form.date}
              onChange={handleTextChange}
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
              {LOCATIONS.map((loc) => (
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
              {UNITS.map((u) => (
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
              {GROUPS.map((g) => (
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
            {measLabelByUnit[form.unit]}
            <input
              className={styles.input}
              name="retainerMeasured"
              type="number"
              step={form.unit === "Imperial" ? "0.0001" : "0.01"}
              inputMode="decimal"
              placeholder={
                nominalRetainerPlaceholder
                  ? `e.g., ${nominalRetainerPlaceholder}`
                  : "required"
              }
              required
              value={form.retainerMeasured}
              onChange={onChangeRetainer}
              onBlur={onBlurRetainer}
            />
          </label>
        </div>

        {/* --- Measurements --- */}
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
          type="button"
          className={styles.button}
          onClick={handleCalculate}
          disabled={
            !form.location ||
            !form.group ||
            !form.modelKey ||
            !form.retainerMeasured ||
            !set1Valid ||
            !set2Valid
          }
        >
          Calculate
        </button>

        {status && (
          <div
            role="status"
            className={calcResult?.ok ? styles.statusValid : styles.statusInvalid}
          >
            {status}
          </div>
        )}

        {calcResult && calcResult.ok && calcResult.chosenFit && (
          <div className={styles.results}>
            <h3>Shim Pack Recommendation</h3>

            <p>
              <strong> </strong>
              {formatByUnit(form.unit, calcResult.chosenFit.shimX)} {tolLabel}
            </p>
            <p>
              <strong>Chosen fit:</strong> {calcResult.chosen}
            </p>
          </div>
        )}

        {/* --- Calculation Diagnostics --- */}
        {calcResult?.ok && (
          <div className={styles.results}>
            <h3>Set Comparison</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fit</th>
                  <th>R²</th>
                  <th>Avg Err (ft-lb)</th>
                  <th>Max Err (ft-lb)</th>
                  <th>Shim Pack ({form.unit === "Imperial" ? "in" : "mm"})</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(["Set1", "Set2", "Combined"] as const).map(
                  (key: "Set1" | "Set2" | "Combined"): JSX.Element | null => {
                    const fit: CalcResult["set1"] | undefined =
                      calcResult[
                        key.toLowerCase() as keyof Pick<
                          CalcResult,
                          "set1" | "set2" | "combined"
                        >
                      ];
                    if (!fit) return null;

                    const dec: number =
                      decimalsByUnit[form.unit as keyof typeof decimalsByUnit];
                    const shim: string = Number.isFinite(fit.shimX)
                      ? fit.shimX.toFixed(dec)
                      : "—";

                    return (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{fit.r2?.toFixed(6) ?? "—"}</td>
                        <td>{fit.avgErr_ftlb?.toFixed(2) ?? "—"}</td>
                        <td>{fit.maxErr_ftlb?.toFixed(2) ?? "—"}</td>
                        <td>{shim}</td>
                        <td>
                          {fit.ok
                            ? "✅ Pass"
                            : `❌ ${fit.reasonIfRejected ?? "Fail"}`}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </form>
    </div>
  );
}
