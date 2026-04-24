<!--
File Name: calculation-validation-logic.md
Project: Acroset
Description: Narrative explanation of Acroset calculation validation rules and workflow assumptions.
Author: Kaelan Groves
Version: 1.0.0
Created Date: 2026-04-23
Modified Date: 2026-04-23
Copyright: 2025. HEPI.
License: Proprietary.
-->

**REFERENCE: /src/config/runtimeConfig.ts**

**DATA VALIDATION**

-- [0] Consistency across rows 
Make sure that row values are within 0.010" or 0.25mm
-confirms consistency and no typos

-- [1] Decreasing monotonicity
Make sure that the average of row values is equal to or less than the previous row
- confirms consistency and no typos

-- [2] Retainer thickness check


**CALCULATION VALIDATION**

-- [0] Theoretical vs. Actual
Real world reference : Snap on 50-250 ft-lb torque wrench 5% FS error

| Setting (ft·lb) | 5% of Setting        | Absolute Error (±) | Range (ft·lb)     |
| --------------- | -------------------- | ------------------ | ----------------- |
| 60              | 0.05 × 60 = **3.0**  | ±3.0               | **57.0 – 63.0**   |
| 80              | 0.05 × 80 = **4.0**  | ±4.0               | **76.0 – 84.0**   |
| 100             | 0.05 × 100 = **5.0** | ±5.0               | **95.0 – 105.0**  |
| 120             | 0.05 × 120 = **6.0** | ±6.0               | **114.0 – 126.0** |
| 140             | 0.05 × 140 = **7.0** | ±7.0               | **133.0 – 147.0** |

Note: The snap on torque wrench spec was used to derive the thresholds of the linear regression. 
The thresholds were simplified to average error: 5 ft-lbs and max error 10 ft-lbs for the points used to calculate the regression.

-- [1] Compare set 1 and set 2 measurements
Assuming that set points are within allowable tolerance. Pick set 1, set 2, or the average of both sets (combined) based lowest max error, then avg error, then highest R², then prefers Combined.
