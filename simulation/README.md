# Acroset Regression Lab

A standalone, browser-based simulator for testing consecutive-window linear regression against historical Acroset measurement exports. It has no SPFx or SharePoint dependency, and imported data stays in the browser.

## Run locally

Requires Node.js 18.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```bash
npm run build
npm run preview
```

## Historical data

Use the **Choose CSV files** control or drag measurement CSV files onto the page. The importer recognizes the export columns currently produced by Acroset:

```text
run_id,torque_index,torque_ftlb,set_id,meas_num,value,value_unit
```

The two measurements at each torque point are averaged. When both Set 1 and Set 2 exist, the simulator also creates a Combined dataset. Results CSV files are not required yet; support for pairing them with measurements can be added after representative files are available.

Do not commit historical files containing operational or personal information. The simulator does not need them stored in this directory.

## Current experiment

For every dataset, the simulator:

1. Generates every consecutive window with at least the configured minimum point count.
2. Fits ordinary least squares to the points in that window.
3. Calculates window metrics and separate metrics over **all original points**.
4. Applies optional engineering limits to slope, reference torque, average error, and maximum error.
5. Ranks passing candidates by all-point maximum error, all-point average error, most included points, and optional target proximity.
6. Displays the proposed line beside the current rule, which removes the first two and final points.

Point and window numbering in the interface is one-based for easier review with exported rows.

## Important interpretation

This is an experimental analysis tool, not approved production calculation logic. Confirm the ranking policy and thresholds with engineering before transferring any logic into SPFx.
