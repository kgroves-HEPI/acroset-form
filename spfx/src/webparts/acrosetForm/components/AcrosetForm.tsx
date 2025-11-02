import * as React from 'react';
import styles from './AcrosetForm.module.scss';

type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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

const positions: Position[] = [1,2,3,4,5,6,7,8];
type FormState = {
  date: string;
  mechanic: string;
  wo: string;
  location: string;
  model: string;
  retainer: string;
} & {
  [K in `shim_${Position}`]: string;
} & {
  [K in `meas_${Position}`]: string;
};

export default function AcrosetForm(): JSX.Element {
  const [form, setForm] = React.useState<FormState>({
    date: '',
    mechanic: '',
    wo: '',
    location: '',
    model: '',
    retainer: '',
    shim_1: '', shim_2: '', shim_3: '', shim_4: '',
    shim_5: '', shim_6: '', shim_7: '', shim_8: '',
    meas_1: '', meas_2: '', meas_3: '', meas_4: '',
    meas_5: '', meas_6: '', meas_7: '', meas_8: '',
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((prev: FormState) => ({ ...prev, [name]: value } as FormState));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    console.log('Form payload:', form);
    alert('Form captured locally. Check console for payload.');
  };




  return (
    <div className={styles.card}>
      <h2 className={styles.h2}>Acroset — Request Form</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
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
            <option value="" disabled>Select…</option>
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
            <option value="" disabled>Select…</option>
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
            step="any"
            placeholder="e.g., 1.500"
            required
            value={form.retainer}
            onChange={onChange}
          />
        </label>

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
                <td>
                  <input
                    className={styles.input}
                    name={`shim_${pos}`}
                    value={form[`shim_${pos}`]}
                    onChange={onChange}

                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    name={`meas_${pos}`}
                    value={form[`meas_${pos}`]}
                    onChange={onChange}

                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    name={`meas_${pos}`}
                    value={form[`meas_${pos}`]}
                    onChange={onChange}

                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    name={`meas_${pos}`}
                    value={form[`meas_${pos}`]}
                    onChange={onChange}

                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
        <button className={styles.button} type="submit">Submit</button>
      </form>
    </div>
  );
}
