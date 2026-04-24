/**
 * File Name: runtimeConfig.ts
 * Project: Acroset
 * Description: Centralized runtime constants and display labels for the Acroset feature.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import type { Unit } from "../calculation/compute";

// Default SharePoint list title shown in the web part property pane and used
// when no override has been provided on the page instance.
export const DEFAULT_LIST_TITLE = "Acroset Log";

// Server-relative library folders that receive the generated CSV outputs for
// each submitted Acroset run.
export const RESULTS_FOLDER = "/teams/MSUSEngineering/Acroset Data/Results";
export const MEASUREMENTS_FOLDER =
  "/teams/MSUSEngineering/Acroset Data/Measurements";

// Maximum allowable difference between the two readings in a measurement pair.
// The values are unit-specific because the form can operate in either inches or
// millimeters while preserving the same business rule intent.
export const pairDeviationMaxByUnit: Record<Unit, number> = {
  Imperial: 0.01,
  Metric: 0.25,
};

// Display precision used when normalizing typed numeric values back into the UI
// after blur events.
export const decimalsByUnit: Record<Unit, number> = {
  Imperial: 3,
  Metric: 2,
};

// Text shown next to the final shim recommendation so mechanics understand the
// reporting tolerance associated with the displayed unit system.
export const resultToleranceLabelByUnit: Record<Unit, string> = {
  Imperial: "± 0.001 in",
  Metric: "± 0.03 mm",
};

// Unit-aware label for the measured retainer input field.
export const retainerInputLabelByUnit: Record<Unit, string> = {
  Imperial: "Measured Retainer Thickness (in)",
  Metric: "Measured Retainer Thickness (mm)",
};

// Shared calculation thresholds other than pair deviation. Pair deviation stays
// separate because it varies by the currently selected unit system.
export const defaultCalculationThresholds = {
  r2Min: 0.95,
  avgErrMax_ftlb: 5,
  maxErrMax_ftlb: 10,
  enforceMonotonic: true,
} as const;
