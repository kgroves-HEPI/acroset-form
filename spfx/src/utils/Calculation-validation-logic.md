
[VALIDATION]  

-- [0] Consistency across rows
Make sure that row values are within .005
-confirms consistency and no typos

-- [1] Theoretical vs. Actual
Spec: Snap on 50-250 ft-lb torque wrench 5% FS error

| Setting (ft·lb) | 5% of Setting        | Absolute Error (±) | Range (ft·lb)     |
| --------------- | -------------------- | ------------------ | ----------------- |
| 60              | 0.05 × 60 = **3.0**  | ±3.0               | **57.0 – 63.0**   |
| 80              | 0.05 × 80 = **4.0**  | ±4.0               | **76.0 – 84.0**   |
| 100             | 0.05 × 100 = **5.0** | ±5.0               | **95.0 – 105.0**  |
| 120             | 0.05 × 120 = **6.0** | ±6.0               | **114.0 – 126.0** |
| 140             | 0.05 × 140 = **7.0** | ±7.0               | **133.0 – 147.0** |

Must make sure that the linear regression falls within the tolerance zone of the actual points. 

-- [2] Compare set 1 and set 2 measurements
Assuming that set points are within allowable tolerance. Pick set 1 or set 2 based on smallest average error across 60,80,100,120 points [**or larger shimpack?**]


