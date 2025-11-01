import * as React from 'react';
import styles from './AcrosetForm.module.scss';

export default function AcrosetForm() {
  const [form, setForm] = React.useState({
    date: '',
    mechanic: '',
    wo: '',
    location: '',
    model: '',
    retainer: ''
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
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

        <button className={styles.button} type="submit">Save (local)</button>
      </form>
    </div>
  );
}
