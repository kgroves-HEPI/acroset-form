/**
 * File Name: retainerValidation.ts
 * Project: Acroset
 * Description: Nominal retainer lookup and measured retainer validation helpers for the Acroset form.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import type { Unit } from "../calculation/compute";
import type { RetainerList } from "../types";

const INCH_TO_MM = 25.4 as const;

export type ValidationTier = "good" | "warn" | "error" | "unknown";

export type RetainerValidationResult = {
  status: ValidationTier;
  msg: string;
  delta?: number;
  nominal?: number;
};

function thresholdsByUnit(unit: Unit) {
  // These bands define the quick retainer sanity check before the full
  // calculation flow runs.
  const goodPositiveInches = 0.01;
  const goodNegativeInches = -0.01;
  const warningNegativeInches = -0.03;

  if (unit === "Imperial") {
    return {
      goodPos: goodPositiveInches,
      goodNeg: goodNegativeInches,
      warnNeg: warningNegativeInches,
    };
  }

  return {
    // Metric thresholds are converted from the inch-based business rule.
    goodPos: goodPositiveInches * INCH_TO_MM,
    goodNeg: goodNegativeInches * INCH_TO_MM,
    warnNeg: warningNegativeInches * INCH_TO_MM,
  };
}

export function getNominalRetainerValue(
  retainerLookup: RetainerList,
  retainerKey: string,
  unit: Unit
): number | undefined {
  // The selected model points to a retainer key, which then resolves to the
  // nominal thickness for the active unit system.
  const record = retainerLookup[retainerKey];
  if (!record) {
    return undefined;
  }

  return unit === "Imperial" ? record.in : record.mm;
}

export function validateRetainerMeasurement(
  measuredValue: string,
  retainerLookup: RetainerList,
  retainerKey: string | undefined,
  unit: Unit
): RetainerValidationResult {
  const measured = parseFloat(measuredValue);
  // If the form is incomplete or the model has not resolved to a retainer yet,
  // keep the UI in a neutral state instead of showing a warning too early.
  const nominal = retainerKey
    ? getNominalRetainerValue(retainerLookup, retainerKey, unit)
    : undefined;

  if (!Number.isFinite(measured) || nominal === undefined) {
    return { status: "unknown", msg: "", delta: undefined, nominal };
  }

  const delta = measured - nominal;
  const thresholds = thresholdsByUnit(unit);

  // Green means comfortably within the accepted nominal delta window.
  if (delta >= thresholds.goodNeg && delta <= thresholds.goodPos) {
    return { status: "good", msg: "Good.", delta, nominal };
  }

  // ** CALCULATION WILL RUN IN THIS STATE ** Yellow allows a narrower negative drift band but prompts a manual recheck.
  if (delta < thresholds.goodNeg && delta >= thresholds.warnNeg) {
    return {
      status: "warn",
      msg: "Double check measurement.",
      delta,
      nominal,
    };
  }

  // Red blocks submission for oversized retainers, while undersized retainers may proceed.
  return {
    status: "error",
    msg: "Value seems unrealistic or retainer has been skim cut. Double check entry and reusability criteria.",
    delta,
    nominal,
  };
}
