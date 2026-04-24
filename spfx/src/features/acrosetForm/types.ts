/**
 * File Name: types.ts
 * Project: Acroset
 * Description: Shared Acroset feature types for lookup data, form state, and exported row shapes.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import type { Group, Unit } from "./calculation/compute";

export type UnitValue = { in: number; mm: number };

export type PreloadList = Record<string, UnitValue>;
export type RetainerList = Record<string, UnitValue>;
export type TorqueArrayList = Record<string, number[]>;

export interface ModelSpec {
  group: Group;
  retainer: keyof RetainerList;
  preload: keyof PreloadList;
  TorqueArray: keyof TorqueArrayList;
}

export type ModelMap = Record<string, ModelSpec>;

export type Row = {
  torque_ftlb: number;
  s1_m1: string;
  s1_m2: string;
  s2_m1: string;
  s2_m2: string;
};

export type RowMeasurement = {
  torque_ftlb: number;
  s1_m1: string | number;
  s1_m2: string | number;
  s2_m1: string | number;
  s2_m2: string | number;
};

export type FormState = {
  date: string;
  mechanic: string;
  wo: string;
  location: string;
  unit: Unit;
  group: Group | "";
  modelKey: string;
  retainerMeasured: string;
  rows: Row[];
};
