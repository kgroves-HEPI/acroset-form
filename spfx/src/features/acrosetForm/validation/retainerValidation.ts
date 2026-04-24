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
  const nominal = retainerKey
    ? getNominalRetainerValue(retainerLookup, retainerKey, unit)
    : undefined;

  if (!Number.isFinite(measured) || nominal === undefined) {
    return { status: "unknown", msg: "", delta: undefined, nominal };
  }

  const delta = measured - nominal;
  const thresholds = thresholdsByUnit(unit);

  if (delta >= thresholds.goodNeg && delta <= thresholds.goodPos) {
    return { status: "good", msg: "Good.", delta, nominal };
  }

  if (delta < thresholds.goodNeg && delta >= thresholds.warnNeg) {
    return {
      status: "warn",
      msg: "Double check measurement.",
      delta,
      nominal,
    };
  }

  return {
    status: "error",
    msg: "Value seems unrealistic or retainer has been skim cut. Double check entry and reusability criteria.",
    delta,
    nominal,
  };
}
