import * as React from "react";
import styles from "./AcrosetForm.module.scss";
import { computeFromFormState, CalcResult } from "../../../utils/compute";

// --- types ---
type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type MeasKey =
  | `meas_s1_1_${Position}`
  | `meas_s1_2_${Position}`
  | `meas_s2_1_${Position}`
  | `meas_s2_2_${Position}`;

//type MeasValue = '' | number;

type FormState = {
  date: string;
  mechanic: string;
  wo: string;
  location: string;
  model: string;
  retainer: string;
} & Record<MeasKey, string>;

// --- constants ---
const positions: Position[] = [1, 2, 3, 4, 5, 6, 7, 8];

const TORQUE_BY_POSITION: Record<Position, number> = {
  1: 0,
  2: 20,
  3: 40,
  4: 60,
  5: 80,
  6: 100,
  7: 120,
  8: 140,
};

// --- component ---
export default function AcrosetForm(): JSX.Element {
  const [calcResult, setCalcResult] = React.useState<CalcResult | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  // build dynamic measurement keys
  const emptyDyn: Record<MeasKey, string> = positions.reduce(
    (acc, pos) => ({
      ...acc,
      [`meas_s1_1_${pos}`]: "",
      [`meas_s1_2_${pos}`]: "",
      [`meas_s2_1_${pos}`]: "",
      [`meas_s2_2_${pos}`]: "",
    }),
    {} as Record<MeasKey, string>
  );

  const [form, setForm] = React.useState<FormState>({
    date: "",
    mechanic: "",
    wo: "",
    location: "",
    model: "",
    retainer: "",
    ...emptyDyn,
  });

  // Check if all Set 1 measurements have values
const set1Complete = React.useMemo(() => {
  return positions.every(
    (pos) =>
      form[`meas_s1_1_${pos}`] !== "" &&
      form[`meas_s1_2_${pos}`] !== ""
  );
}, [form]);

const descendingValid = React.useMemo(() => {
  const columns: MeasKey[][] = [
    positions.map((pos) => `meas_s1_1_${pos}` as MeasKey),
    positions.map((pos) => `meas_s1_2_${pos}` as MeasKey),
    positions.map((pos) => `meas_s2_1_${pos}` as MeasKey),
    positions.map((pos) => `meas_s2_2_${pos}` as MeasKey),
  ];

  return columns.every((col) => {
    const nums = col
      .map((key) => parseFloat(form[key]))
      .filter((n) => !isNaN(n));
    return isDescending(nums);
  });
}, [form]);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value, type } = e.target;

    if (type === "number") {
      // allow only digits, optional single dot, optional negative sign
      const validNumberInput = /^-?\d*\.?\d*$/.test(value);
      if (!validNumberInput && value !== "") return; // block invalid inputs
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onBlurNumber = (e: React.FocusEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    const n = parseFloat(value);

    if (!isNaN(n)) {
      // Clamp to 4 decimals and optionally enforce range (e.g. 0 to 2 inches)
      const formatted = Math.max(0, n).toFixed(3); // remove Math.max if negatives are allowed
      setForm((prev) => ({ ...prev, [name]: formatted }));
    }
  };

  function isDescending(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) return false;
  }
  return true;
}

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    console.log("Form payload:", form);
    alert("Form captured locally. Check console for payload.");
  };
  const handleCalculate = (): void => {
    const result = computeFromFormState(form);

    if (!result.ok) {
      setCalcResult(null);
      setStatus(result.reason); // show validation or regression error
      return;
    }

    setCalcResult(result);
    setStatus("Calculation complete.");
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.h2}>Acroset — Request Form</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.gridFormRow}>
          <label className={styles.label}>
            Date
            <input
              className={styles.input}
              name="date"
              placeholder="MM/DD/YYYY"
              value={form.date}
              onChange={onChange}
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
              onChange={onChange}
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
              onChange={onChange}
            />
          </label>

          <label className={styles.label}>
            Location
            <select
              className={styles.input}
              name="location"
              required
              value={form.location}
              onChange={onChange}
            >
              <option value="" disabled>
                Select…
              </option>
              <option>Billings</option>
              <option>Leduc</option>
            </select>
          </label>

          <label className={styles.label}>
            Model
            <select
              className={styles.input}
              name="model"
              required
              value={form.model}
              onChange={onChange}
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="777 Front">777 Front</option>
              <option value="797 Front">797 Front</option>
              <option value="830E Front">830E Front</option>
              <option value="930E Front">930E Front</option>
            </select>
          </label>

          <label className={styles.label}>
            Measured Retainer Thickness (in)
            <input
              className={styles.input}
              name="retainer"
              type="number"
              step="0.0001"
              inputMode="decimal"
              placeholder="e.g., 1.5000"
              required
              value={form.retainer}
              onChange={onChange}
              onBlur={onBlurNumber}
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
                <th colSpan={2}>Set 1 (in)</th>
                <th colSpan={2}>Set 2 (in)</th>
              </tr>
              <tr>
                <th>Meas. #1</th>
                <th>Meas. #2</th>
                <th>Meas. #1</th>
                <th>Meas. #2</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos}>
                  <td>{TORQUE_BY_POSITION[pos]}</td>

                  {/* Set 1 */}
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      name={`meas_s1_1_${pos}`}
                      value={form[`meas_s1_1_${pos}` as MeasKey]}
                      onChange={onChange}
                      onBlur={onBlurNumber}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      name={`meas_s1_2_${pos}`}
                      value={form[`meas_s1_2_${pos}` as MeasKey]}
                      onChange={onChange}
                      onBlur={onBlurNumber}
                    />
                  </td>

                  {/* Set 2 */}
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      name={`meas_s2_1_${pos}`}
                      value={form[`meas_s2_1_${pos}` as MeasKey]}
                      onChange={onChange}
                      onBlur={onBlurNumber}
                      disabled={!set1Complete}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      name={`meas_s2_2_${pos}`}
                      value={form[`meas_s2_2_${pos}` as MeasKey]}
                      onChange={onChange}
                      onBlur={onBlurNumber}
                      disabled={!set1Complete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className={styles.button}
          onClick={handleCalculate}
          disabled={!set1Complete || !descendingValid}
        >
          Calculate
        </button>
        {status && <div className={styles.status}>{status}</div>}

        {calcResult && (
          <div className={styles.results}>
            <h3>Shim Pack Recommendation</h3>
            <p>
              <strong>Recommended:</strong> {calcResult.shimX?.toFixed(3)} ±
              0.001 in
            </p>
            <p>
              <strong>Slope (a):</strong> {calcResult.fit.a.toFixed(6)}
            </p>
            <p>
              <strong>R²:</strong> {calcResult.fit.r2.toFixed(6)}
            </p>
            <p>
              <strong>Avg Error:</strong> {calcResult.fit.avgErr.toFixed(4)}{" "}
              ft-lb
            </p>
            <p>
              <strong>Max Error:</strong> {calcResult.fit.maxErr.toFixed(4)}{" "}
              ft-lb
            </p>
            <p>
              <strong>Torque at Shim Pack:</strong>{" "}
              {calcResult.yAtShim?.toFixed(4) ?? "—"} ft-lb
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
