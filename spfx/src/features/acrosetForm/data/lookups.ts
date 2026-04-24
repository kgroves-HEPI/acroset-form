/**
 * File Name: lookups.ts
 * Project: Acroset
 * Description: Typed accessors for Acroset lookup JSON files used by the form and calculation flow.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import type { Group, Unit } from "../calculation/compute";
import type {
  ModelMap,
  PreloadList,
  RetainerList,
  TorqueArrayList,
} from "../types";

import groupListJson from "./groupList.json";
import locationListJson from "./locationList.json";
import modelFrontJson from "./modelFrontList.json";
import modelRearJson from "./modelRearList.json";
import preloadListJson from "./preloadList.json";
import retainerListJson from "./retainerList.json";
import torqueArrayListJson from "./torqueArrayList.json";
import unitsListJson from "./unitsList.json";

export const frontModels = modelFrontJson as unknown as ModelMap;
export const rearModels = modelRearJson as unknown as ModelMap;
export const preloadLookup = preloadListJson as unknown as PreloadList;
export const retainerLookup = retainerListJson as unknown as RetainerList;
export const torqueArrayLookup =
  torqueArrayListJson as unknown as TorqueArrayList;
export const unitOptions = unitsListJson as Unit[];
export const groupOptions = groupListJson as Group[];
export const locationOptions = locationListJson as string[];
