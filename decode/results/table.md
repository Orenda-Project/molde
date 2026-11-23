| arm | quant | set | n | checker pass | intent score | intent auto | median lines (ref) | median s/app | median tok/s | median calls | one-line progs | first-error classes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A static grammar, one call (chat template, as r1 report) | Q8_0 | real wording | 44 | 50.0% | 0.629 | 18.2% | 10 (11.5) | 2.46 | 57.3 | 1 | 1 | UNKNOWN_FIELD:7 TYPE:4 UNKNOWN_NAME:3 DUP:2 UNKNOWN_COMPONENT:2 CHILD:1 DEFAULT:1 UNKNOWN_TABLE:1 SYNTAX:1 |
| A2 as A, real special-token ids | Q8_0 | real wording | 44 | 45.5% | 0.626 | 18.2% | 11 (11.5) | 2.33 | 59.5 | 1 | 0 | UNKNOWN_NAME:7 TYPE:6 UNKNOWN_FIELD:5 UNKNOWN_COMPONENT:2 SYNTAX:1 DUP:1 CONTEXT:1 REF:1 |
| B lines + static grammar + resample | Q8_0 | real wording | 44 | 56.8% | 0.615 | 20.5% | 11 (11.5) | 3.43 | 66.6 | 14.5 | 0 | UNKNOWN_FIELD:8 TYPE:5 UNKNOWN_NAME:3 SYNTAX:1 DUP:1 UNKNOWN_COMPONENT:1 |
| C lines + name grammar | Q8_0 | real wording | 44 | 70.5% | 0.615 | 20.5% | 10 (11.5) | 2.58 | 70.4 | 11 | 0 | TYPE:8 UNKNOWN_FIELD:3 DUP:1 UNKNOWN_NAME:1 |
| D = C + resample | Q8_0 | real wording | 44 | 70.5% | 0.631 | 22.7% | 11 (11.5) | 2.73 | 71.3 | 12.5 | 0 | TYPE:7 UNKNOWN_FIELD:2 UNKNOWN_NAME:2 DUP:1 SYNTAX:1 |
| E = D + type filters (extra) | Q8_0 | real wording | 44 | 77.3% | 0.622 | 22.7% | 11 (11.5) | 3.18 | 59 | 13 | 1 | TYPE:3 UNKNOWN_FIELD:2 UNKNOWN_NAME:2 DUP:1 SYNTAX:1 HEADER:1 |
| A static grammar, one call (chat template, as r1 report) | Q4_K_M | real wording | 44 | 43.2% | 0.651 | 11.4% | 10 (11.5) | 2.32 | 59.2 | 1 | 0 | TYPE:8 UNKNOWN_FIELD:7 UNKNOWN_NAME:4 UNKNOWN_TABLE:2 REF:1 CONTEXT:1 ARGS:1 SYNTAX:1 |
| A2 as A, real special-token ids | Q4_K_M | real wording | 44 | 45.5% | 0.637 | 13.6% | 10.5 (11.5) | 4.83 | 55.9 | 1 | 0 | UNKNOWN_NAME:10 UNKNOWN_FIELD:5 TYPE:4 DUP:2 UNKNOWN_COMPONENT:2 CONTEXT:1 |
| B lines + static grammar + resample | Q4_K_M | real wording | 44 | 52.3% | 0.634 | 18.2% | 10 (11.5) | 12.13 | 50.1 | 14 | 0 | TYPE:6 UNKNOWN_NAME:4 UNKNOWN_FIELD:4 REF:2 WINDOW:1 DUP:1 UNKNOWN_TABLE:1 ACTION:1 UNKNOWN_COMPONENT:1 |
| C lines + name grammar | Q4_K_M | real wording | 44 | 56.8% | 0.662 | 20.5% | 10 (11.5) | 3.54 | 46.3 | 11 | 0 | TYPE:12 DUP:2 UNKNOWN_FIELD:2 CONTEXT:1 ACTION:1 UNKNOWN_NAME:1 |
| D = C + resample | Q4_K_M | real wording | 44 | 72.7% | 0.654 | 25.0% | 10.5 (11.5) | 5 | 41.4 | 13 | 0 | TYPE:7 DUP:1 CONTEXT:1 UNKNOWN_FIELD:1 ACTION:1 UNKNOWN_NAME:1 |
| E = D + type filters (extra) | Q4_K_M | real wording | 44 | 75.0% | 0.662 | 25.0% | 10 (11.5) | 7.05 | 29.9 | 12.5 | 0 | TYPE:5 UNKNOWN_FIELD:2 DUP:1 CONTEXT:1 ACTION:1 UNKNOWN_NAME:1 |
| A static grammar, one call (chat template, as r1 report) | Q8_0 | templated | 60 | 86.7% | 0.887 | 73.3% | 10 (10) | 2.2 | 66 | 1 | 0 | DUP:3 UNKNOWN_FIELD:2 REQUIRED:1 ICON:1 UNKNOWN_NAME:1 |
| A2 as A, real special-token ids | Q8_0 | templated | 60 | 88.3% | 0.873 | 78.3% | 10 (10) | 1.98 | 64.8 | 1 | 0 | DUP:2 REQUIRED:1 SYNTAX:1 UNKNOWN_TABLE:1 TYPE:1 UNKNOWN_NAME:1 |
| B lines + static grammar + resample | Q8_0 | templated | 60 | 91.7% | 0.875 | 76.7% | 10 (10) | 2.41 | 68.2 | 11 | 0 | DUP:2 ICON:1 TYPE:1 UNKNOWN_NAME:1 |
| C lines + name grammar | Q8_0 | templated | 60 | 93.3% | 0.87 | 78.3% | 10 (10) | 2.5 | 72.1 | 11 | 0 | DUP:2 TYPE:1 UNKNOWN_NAME:1 |
| D = C + resample | Q8_0 | templated | 60 | 95.0% | 0.871 | 78.3% | 10 (10) | 2.33 | 73.9 | 11 | 0 | DUP:2 UNKNOWN_NAME:1 |
| E = D + type filters (extra) | Q8_0 | templated | 60 | 95.0% | 0.871 | 80.0% | 10 (10) | 4.23 | 44.5 | 11 | 0 | DUP:2 UNKNOWN_NAME:1 |
| A static grammar, one call (chat template, as r1 report) | Q4_K_M | templated | 60 | 83.3% | 0.874 | 75.0% | 10 (10) | 2.64 | 51.4 | 1 | 1 | TYPE:3 DUP:2 RANGE:1 SYNTAX:1 REQUIRED:1 ICON:1 UNKNOWN_FIELD:1 |
| A2 as A, real special-token ids | Q4_K_M | templated | 60 | 85.0% | 0.882 | 76.7% | 10 (10) | 2.92 | 48.1 | 1 | 1 | TYPE:3 RANGE:1 SYNTAX:1 ICON:1 DUP:1 INTERNAL:1 UNKNOWN_FIELD:1 |
| B lines + static grammar + resample | Q4_K_M | templated | 60 | 86.7% | 0.887 | 76.7% | 10.5 (10) | 6.29 | 35.5 | 12 | 1 | TYPE:2 REQUIRED:1 ICON:1 DUP:1 UNKNOWN_NAME:1 INTERNAL:1 UNKNOWN_FIELD:1 |
| C lines + name grammar | Q4_K_M | templated | 60 | 90.0% | 0.874 | 76.7% | 10 (10) | 5.81 | 34.3 | 11 | 1 | DUP:2 RANGE:1 REQUIRED:1 TYPE:1 CONTEXT:1 |
| D = C + resample | Q4_K_M | templated | 60 | 91.7% | 0.875 | 78.3% | 10 (10) | 5.27 | 35 | 11.5 | 1 | DUP:2 REQUIRED:1 TYPE:1 CONTEXT:1 |
| E = D + type filters (extra) | Q4_K_M | templated | 60 | 91.7% | 0.882 | 78.3% | 10 (10) | 5.68 | 38.3 | 11 | 1 | DUP:2 REQUIRED:1 TYPE:1 CONTEXT:1 |
