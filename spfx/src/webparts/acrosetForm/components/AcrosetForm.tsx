import * as React from 'react';
import { useState } from 'react';
import styles from './AcrosetForm.module.scss';
import type { IAcrosetFormProps } from './IAcrosetFormProps';

export default function AcrosetForm(_: IAcrosetFormProps) {
  const [title, setTitle] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [model, setModel] = useState('');
  const [priority, setPriority] = useState<'Critical' | 'High' | 'Normal' | 'Low'>('Normal');
  const [needBy, setNeedBy] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now just prove it works:
    console.log({ title, workOrder, model, priority, needBy });
    alert('Form captured locally. Check console for payload.');
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.h2}>Acroset — Request Form</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          Title
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short description"
            required
          />
        </label>

        <label className={styles.label}>
          Work Order #
          <input
            className={styles.input}
            value={workOrder}
            onChange={(e) => setWorkOrder(e.target.value)}
            placeholder="e.g., WO-12345"
          />
        </label>

        <label className={styles.label}>
          Model
          <input
            className={styles.input}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g., XYZ-200"
          />
        </label>

        <label className={styles.label}>
          Priority
          <select
            className={styles.input}
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
          >
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>
        </label>

        <label className={styles.label}>
          Need by date
          <input
            className={styles.input}
            type="date"
            value={needBy}
            onChange={(e) => setNeedBy(e.target.value)}
          />
        </label>

        <button className={styles.button} type="submit">Save (local)</button>
      </form>
    </div>
  );
}
