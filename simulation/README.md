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

The simulator automatically loads and pairs the checked-in measurement and result CSVs by their exact `run_id`. Measurement files use:

```text
run_id,torque_index,torque_ftlb,set_id,meas_num,value,value_unit
```

The two measurements at each torque point are averaged. Set 1 and Set 2 are then averaged to create the Combined dataset. Result files supply the historic metadata, regression outputs, errors, status, and shim-pack values.

### Unit-normalized data

The original `data/measurements` and `data/results` directories remain unchanged. Generate complete Imperial and Metric representations with:

```bash
npm run convert:data-units
```

This writes every run to `measurements-imperial`, `measurements-metric`, `results-imperial`, and `results-metric`. Distance values and torque-per-distance slopes are converted; torque values and other dimensionless or torque-only outputs are unchanged. The normalized result files also correct the legacy chosen-shim unit/torque field inversion while preserving the declared CSV schema.

The page reads these normalized folders directly. Use the unit toggle to switch the complete report between Imperial and Metric records. Runs are grouped and sorted by model/group. Selecting a model/group plots every corresponding record in both methodology cards; the run selector emphasizes one record and drives the detailed outputs and error tables.

Torque is globally reported in ft-lb. Regression slopes are also reported consistently as `ft-lb/in` in both unit views so their displayed values remain comparable; Metric chart calculations retain the mathematically equivalent internal `ft-lb/mm` slope because their X coordinates are millimeters.

### Excluded records

Records intentionally removed from validation are retained under `data/excluded`, using matching subfolders for original measurements/results and both normalized unit representations. Moving all six files for a run into this archive removes it from the simulator without deleting its raw or converted history. Restore a run by moving its files back to their corresponding active folders.

Do not commit historical files containing operational or personal information. The simulator does not need them stored in this directory.

## Current experiment

For every run and each of Set 1, Set 2, and Combined, the simulator:

1. Displays the historic line and outputs exactly as stored in the paired result CSV.
2. Generates every window of exactly five consecutive averaged points.
3. Fits ordinary least squares to each window in shim space (`measurement - retainer measurement`).
4. Selects the window with the highest in-window R², using RMSE and all-point maximum error only as deterministic tie-breakers.
5. Calculates the proposed shim pack using the legacy formula: `(-regression intercept / slope) - preload`, then reports the torque intercept where that shim-pack X value intersects the regression line: `slope × shim pack + regression intercept`.
6. Shows signed residual and absolute error at every point for both methods.

Each method card plots Set 1, Set 2, and Combined together. The detail-focus control emphasizes one series and selects the corresponding numeric output and point-error table.

When a single model/group is selected, both plots show a unit-normalized acceptable band from `data/reference/targets.csv`. Its two parallel boundaries use the model's target slope and minimum/maximum shim pack, positioned with the model preload target. Use **Exclude selected record** to remove known test inputs from the plotted validation cluster without modifying any source CSV; the action is reversible for the current browser session.

The plots also show a horizontal torque acceptance zone from the model's minimum and maximum target torque, with its average as a dashed centerline. Each regression output is drawn as a vertical shim line and horizontal torque line. The overlap of the slope/shim zone and torque zone is the combined acceptable region; the selected record's output guides are emphasized while the rest of the model cluster remains faint.

Selecting a run drills both plots down to that individual record. Use **Show model cluster** to return to plotting every included record for the selected model/group.

In model-cluster view, each methodology card includes a shim-pack scorecard. It reports Set 1, Set 2, and Combined minimum/average/maximum/standard deviation; Combined compliance with the model shim range; Set 1/Set 2 absolute and symmetric percentage differences; and their variation as a percentage of the model preload target. These scorecards are intentionally shim-only for the first reporting pass.

Point and window numbering in the interface is one-based for easier review with exported rows.

## Important interpretation

This is an experimental analysis tool, not approved production calculation logic. Confirm the ranking policy and thresholds with engineering before transferring any logic into SPFx.
