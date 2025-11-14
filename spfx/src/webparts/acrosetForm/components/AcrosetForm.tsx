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

import { getSP } from "../../../pnpjsConfig";

// --- data (adjust paths to match your project) ---
import modelFront from "../../../data/modelFrontList.json";
import modelRear from "../../../data/modelRearList.json";
import preloadList from "../../../data/preloadList.json";
import retainerList from "../../../data/retainerList.json";
import torqueArrayList from "../../../data/torqueArrayList.json";
import unitsList from "../../../data/unitsList.json";
import groupList from "../../../data/groupList.json";
import locationList from "../../../data/locationList.json";

import { Guid } from "@microsoft/sp-core-library";

//Retainer thickness Validation
// --- Retainer validation helpers ---
const IN_TO_MM = 25.4 as const;
type ValidTier = "good" | "warn" | "error" | "unknown";

function thresholdsByUnit(unit: Unit) {
  // Good:  -0.010..+0.010 in
  // Warn:  -0.030..-0.010 in
  // Error: < -0.030 or > +0.010 in
  const goodPos_in = 0.01,
    goodNeg_in = -0.01,
    warnNeg_in = -0.03;
  if (unit === "Imperial")
    return { goodPos: goodPos_in, goodNeg: goodNeg_in, warnNeg: warnNeg_in };
  const f = IN_TO_MM;
  return {
    goodPos: goodPos_in * f,
    goodNeg: goodNeg_in * f,
    warnNeg: warnNeg_in * f,
  };
}

function getNominalRetainer(
  retainerKey: string,
  unit: Unit
): number | undefined {
  const rec: any = (retainerList as any)?.[retainerKey];
  if (!rec) return undefined;
  return unit === "Imperial" ? rec.in : rec.mm;
}

function validateRetainer(
  measuredStr: string,
  retainerKey: string | undefined,
  unit: Unit
): { status: ValidTier; msg: string; delta?: number; nominal?: number } {
  const measured = parseFloat(measuredStr);
  const nominal = retainerKey
    ? getNominalRetainer(retainerKey, unit)
    : undefined;

  if (!Number.isFinite(measured) || nominal === undefined) {
    return { status: "unknown", msg: "", delta: undefined, nominal };
  }

  const delta = measured - nominal;
  const th = thresholdsByUnit(unit);
  if (delta >= th.goodNeg && delta <= th.goodPos) {
    return { status: "good", msg: "Good.", delta, nominal };
  }
  if (delta < th.goodNeg && delta >= th.warnNeg) {
    return { status: "warn", msg: "Double check measurement.", delta, nominal };
  }
  return {
    status: "error",
    msg: "Value seems unrealistic or retainer has been skim cut. Double check entry and reusability criteria.",
    delta,
    nominal,
  };
}

// CSV BLOCK

type FitId = "Set1" | "Set2" | "Combined";
type FitStats = CalcResult["set1"];

type RowMeas = {
  torque_ftlb: number;
  s1_m1: string | number;
  s1_m2: string | number;
  s2_m1: string | number;
  s2_m2: string | number;
};

const RESULTS_FOLDER = "/teams/MSUSEngineering/Acroset Data/Results";
const MEASUREMENTS_FOLDER = "/teams/MSUSEngineering/Acroset Data/Measurements";

const csvQuote = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLine = (arr: (string | number)[]) =>
  arr.map(csvQuote).join(",") + "\n";

const toNumberOrBlank = (v: any) =>
  Number.isFinite(Number(v)) ? Number(v) : "";

// Build results CSV (one row) with exact headers approved
function buildresultsCsv(args: {
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
  const chosen_fit: FitId | "" =
    result.ok && result.chosen ? result.chosen : "";
  const byFit = (id: FitId): FitStats | undefined =>
    id === "Set1" ? result.set1 : id === "Set2" ? result.set2 : result.combined;

  const chosenStats = chosen_fit ? byFit(chosen_fit) : undefined;
  const chosen_shim_value = chosenStats?.shimX ?? "";
  const calc_status = result.ok ? "Pass" : "Fail";

  const extract = (fs?: FitStats) => {
    const anyFs = fs as any; // allow optional fields not in the TS type
    return {
      slope: toNumberOrBlank(anyFs?.slope),
      intercept: toNumberOrBlank(anyFs?.intercept),
      r2: toNumberOrBlank(anyFs?.r2),
      avg: toNumberOrBlank(anyFs?.avgErr_ftlb),
      max: toNumberOrBlank(anyFs?.maxErr_ftlb),
      shim: toNumberOrBlank(anyFs?.shimX),
      status: anyFs?.ok === undefined ? "" : anyFs.ok ? "Pass" : "Fail",
      reason: anyFs?.ok ? "" : anyFs?.reasonIfRejected ?? "",
    };
  };

  const s1 = extract(result.set1);
  const s2 = extract(result.set2);
  const sc = extract(result.combined);

  let csv = "";
  // headers (exact)
  csv += csvLine([
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
    "set1_slope",
    "set1_intercept",
    "set1_r2",
    "set1_avg_err_ftlb",
    "set1_max_err_ftlb",
    "set1_shim_value",
    "set1_shim_unit",
    "set1_status",
    "set1_reject_reason",
    "set2_slope",
    "set2_intercept",
    "set2_r2",
    "set2_avg_err_ftlb",
    "set2_max_err_ftlb",
    "set2_shim_value",
    "set2_shim_unit",
    "set2_status",
    "set2_reject_reason",
    "combined_slope",
    "combined_intercept",
    "combined_r2",
    "combined_avg_err_ftlb",
    "combined_max_err_ftlb",
    "combined_shim_value",
    "combined_shim_unit",
    "combined_status",
    "combined_reject_reason",
  ]);

  // single data row
  csv += csvLine([
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
    calc_status,
    chosen_fit,
    chosen_shim_value,
    unitShim,
    s1.slope,
    s1.intercept,
    s1.r2,
    s1.avg,
    s1.max,
    s1.shim,
    unitShim,
    s1.status,
    s1.reason,
    s2.slope,
    s2.intercept,
    s2.r2,
    s2.avg,
    s2.max,
    s2.shim,
    unitShim,
    s2.status,
    s2.reason,
    sc.slope,
    sc.intercept,
    sc.r2,
    sc.avg,
    sc.max,
    sc.shim,
    unitShim,
    sc.status,
    sc.reason,
  ]);

  return csv;
}

// Build Measurements CSV (long/tidy) with exact headers approved
function buildMeasurementsCsv(args: {
  run_id: string;
  rows: RowMeas[];
  units: Unit;
}) {
  const { run_id, rows, units } = args;
  const vUnit = units === "Imperial" ? "in" : "mm";

  let csv = "";
  csv += csvLine([
    "run_id",
    "torque_index",
    "torque_ftlb",
    "set_id",
    "meas_num",
    "value",
    "value_unit",
  ]);

  rows.forEach((r, idx) => {
    const i = idx + 1;
    const torque = toNumberOrBlank(r.torque_ftlb);

    // Set1 meas1 & meas2
    csv += csvLine([
      run_id,
      i,
      torque,
      "Set1",
      1,
      toNumberOrBlank(r.s1_m1),
      vUnit,
    ]);
    csv += csvLine([
      run_id,
      i,
      torque,
      "Set1",
      2,
      toNumberOrBlank(r.s1_m2),
      vUnit,
    ]);

    // Set2 meas1 & meas2
    csv += csvLine([
      run_id,
      i,
      torque,
      "Set2",
      1,
      toNumberOrBlank(r.s2_m1),
      vUnit,
    ]);
    csv += csvLine([
      run_id,
      i,
      torque,
      "Set2",
      2,
      toNumberOrBlank(r.s2_m2),
      vUnit,
    ]);
  });

  return csv;
}

async function uploadCsvToFolder(
  folderServerRelativePath: string,
  fileName: string,
  csvText: string
) {
  const sp = getSP();
  const webAny: any = sp.web as any;

  // 1) Resolve the folder object (new or old API)
  const folder =
    webAny.getFolderByServerRelativePath?.(folderServerRelativePath) ||
    webAny.getFolderByServerRelativeUrl?.(folderServerRelativePath);

  if (!folder) {
    throw new Error(
      "Folder API not available. Ensure '@pnp/sp/folders' is imported."
    );
  }

  // 2) Upload the file (prefer addUsingPath, fallback to add)
  const filesAny: any = folder.files;
  if (filesAny?.addUsingPath) {
    await filesAny.addUsingPath(fileName, csvText, { Overwrite: true });
  } else {
    await filesAny.add(fileName, csvText, true);
  }

  // 3) Read back file info using path or url API
  const fileRef = `${folderServerRelativePath}/${fileName}`;
  const fileSel =
    webAny.getFileByServerRelativePath?.(fileRef) ||
    webAny.getFileByServerRelativeUrl?.(fileRef);

  const file = await fileSel.select(
    "ServerRelativeUrl",
    "LinkingUri",
    "Name",
    "UniqueId"
  )();

  const absUrl =
    file.LinkingUri ?? `${window.location.origin}${file.ServerRelativeUrl}`;
  return {
    absUrl,
    uniqueId: file.UniqueId as string,
    name: file.Name as string,
  };
}

interface AcrosetFormProps {
  listTitle: string;
}

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

export default function AcrosetForm({
  listTitle,
}: AcrosetFormProps): JSX.Element {
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

  const [saving, setSaving] = React.useState(false);
  // near your other useState inits, if you want today's default:
  const todayYmd = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  //const testConnectivity = async (): Promise<void> => {
  //try {
  // const sp = getSP();
  // const list = await sp.web.lists.getByTitle(listTitle)(); // throws if wrong / no permission
  //const anyItem = await sp.web.lists.getByTitle(listTitle).items.select("Id").top(1)();
  //alert(`✅ Connected to "${list.Title}". Read ok, items found: ${anyItem.length}`);
  //} catch (e: any) {
  //alert(`❌ Connection failed: ${e?.message ?? e}`);
  //}
  //};
  // --- Component state for validation result ---
  const [retainerCheck, setRetainerCheck] = React.useState<{
    status: ValidTier;
    msg: string;
    delta?: number;
    nominal?: number;
  }>({ status: "unknown", msg: "" });

  const [form, setForm] = React.useState<FormState>({
    date: todayYmd,
    mechanic: "",
    wo: "",
    location: "",
    unit: UNITS[0] ?? "Imperial",
    group: "",
    modelKey: "",
    retainerMeasured: "",
    rows: [],
  });

  // 1) derive model spec first
  const modelSpec: ModelSpec | null = React.useMemo(() => {
    if (!form.group || !form.modelKey) return null;
    const isFront = (form.group || "").toLowerCase() === "front";
    const mm = isFront ? FRONT_MODELS : REAR_MODELS;
    return (mm[form.modelKey] as ModelSpec) ?? null;
  }, [form.group, form.modelKey]);

  // 2) then use it inside the effect
  React.useEffect(() => {
    const retainerKey = modelSpec?.retainer; // may be undefined
    setRetainerCheck(
      validateRetainer(form.retainerMeasured, retainerKey, form.unit as Unit)
    );
  }, [form.retainerMeasured, form.unit, modelSpec?.retainer]);

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
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const shortGuid = Guid.newGuid().toString().slice(0, 4);
    // before you build ComputeInput / call compute(...)
    const current = validateRetainer(
      form.retainerMeasured,
      modelSpec?.retainer,
      form.unit as Unit
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
      // --- build input & run calculations  ---
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
        preload: preloadValue,
        retainerMeasured: parseFloat(form.retainerMeasured),
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

      // inside handleSubmit, before building payload:
      const dateIso = form.date ? ymdToIso(form.date) : null;
      if (!dateIso) {
        setStatus("❌ Invalid date. Pick a valid date.");
        setSaving(false);
        return;
      }

      // 2) Prepare run + common fields
      const run_id = `${form.wo}_${form.date}_${shortGuid}`;
      const date_iso_ui = form.date; // "YYYY-MM-DD" coming from your UI
      const units: Unit = form.unit as Unit; // "Imperial" | "Metric"
      const preload_ftlb =
        typeof input.preload === "number" ? input.preload : preloadValue;
      const retainer_measured_value = Number(form.retainerMeasured ?? 0);

      // 3) Build CSV contents EXACTLY as approved
      const resultsCsv = buildresultsCsv({
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
        rows: form.rows as RowMeas[],
        units,
      });

      // 4) Upload both files to your folders
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

      // --- save to SharePoint regardless of pass/fail ---
      const payload: Record<string, any> = {
        Title: `${form.wo || "WO"}-${form.modelKey || "Model"}-${form.group}-${
          form.location
        }`,
        Date: dateIso,
        Mechanic: form.mechanic,
        //WorkOrder: form.wo,
        //Location: form.location,
        //Group: form.group,
        //Model: form.modelKey,
        //Retainer: parseFloat(form.retainerMeasured),
        //Measurements: JSON.stringify(form.rows),
        Status: result.ok ? "Pass" : result.message ?? "Fail",
        // CalcOk: result.ok,           // (optional Yes/No column)

        //Units: form.unit,
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
          type="submit"
          className={styles.button}
          disabled={
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
                  {formatByUnit(form.unit, fit.shimX)} {tolLabel}
                </p>
              </div>
            );
          })()}
      </form>
    </div>
  );
}
