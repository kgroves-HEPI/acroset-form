/**
 * File Name: measurementValidation.ts
 * Project: Acroset
 * Description: Unit-aware measurement parsing, formatting, and validation helpers for the Acroset form.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import {
  decimalsByUnit,
  pairDeviationMaxByUnit,
} from "../config/runtimeConfig";
import type { Unit } from "../calculation/compute";
import type { UnitValue } from "../types";

export function pickValueByUnit(unit: Unit, value: UnitValue): number {
  return unit === "Imperial" ? value.in : value.mm;
}

export function formatValueByUnit(unit: Unit, value: number): string {
  return value.toFixed(decimalsByUnit[unit]);
}

export function parseNonNegativeNumber(value: string): number | undefined {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export function isWithinPairDeviation(
  unit: Unit,
  value1: number,
  value2: number
): boolean {
  return Math.abs(value1 - value2) <= pairDeviationMaxByUnit[unit];
}

export function isNonIncreasing(values: number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) {
      return false;
    }
  }

  return true;
}

export function buildMonotonicFlags(
  averages: Array<number | undefined>
): boolean[] {
  return averages.map((average, index) => {
    if (index === 0 || average === undefined || averages[index - 1] === undefined) {
      return true;
    }

    return average <= (averages[index - 1] as number);
  });
}
