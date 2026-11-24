# Dataset statistics

file: `v1.jsonl`  pairs: **5469**  language commit: `6801a61` (round 3, verified with /tmp/molde-p0/lang tools: migrate, check, format, eval, diff with history form)

Independent verifier (NOCACHE, plus CLI cross-check of 150 programs): 5469/5469 pass, 0 token overruns, 0 refused diffs. See v1.verify.md.

### By task

| value | n | share |
|---|---:|---:|
| create | 4210 | 77.0% |
| edit | 1259 | 23.0% |

### By method (family)

| value | n | share |
|---|---:|---:|
| template | 2579 | 47.2% |
| edit-template | 894 | 16.3% |
| hand | 633 | 11.6% |
| mutate | 537 | 9.8% |
| oos | 265 | 4.8% |
| mutate-edit | 188 | 3.4% |
| hand-edit | 177 | 3.2% |
| hand-ask | 158 | 2.9% |
| hand-oos | 38 | 0.7% |

### By method (detailed)

| value | n | share |
|---|---:|---:|
| template:quantity | 649 | 11.9% |
| hand | 633 | 11.6% |
| template:mixedlog | 391 | 7.1% |
| template:countlog | 272 | 5.0% |
| mutate:theme | 254 | 4.6% |
| mutate:name | 239 | 4.4% |
| edit-template:quantity | 225 | 4.1% |
| template:habits | 212 | 3.9% |
| template:ringcounter | 191 | 3.5% |
| template:expenses | 189 | 3.5% |
| template:scoreboard | 177 | 3.2% |
| hand-edit | 177 | 3.2% |
| template:stock | 152 | 2.8% |
| template:timer | 133 | 2.4% |
| template:todo | 125 | 2.3% |
| edit-template:mixedlog | 109 | 2.0% |
| edit-template:countlog | 100 | 1.8% |
| mutate-edit:name | 93 | 1.7% |
| edit-template:ringcounter | 73 | 1.3% |
| edit-template:habits | 70 | 1.3% |
| edit-template:expenses | 67 | 1.2% |
| hand-ask | 67 | 1.2% |
| edit-template:stock | 65 | 1.2% |
| template:ledger | 64 | 1.2% |
| edit-template:scoreboard | 58 | 1.1% |
| edit-template:todo | 56 | 1.0% |
| hand-ask:typo | 52 | 1.0% |
| oos:quantity | 49 | 0.9% |
| edit-template:timer | 46 | 0.8% |
| oos:mixedlog | 41 | 0.7% |
| hand-ask:prefix | 39 | 0.7% |
| hand-oos | 38 | 0.7% |
| mutate:goal | 34 | 0.6% |
| mutate-edit:note | 29 | 0.5% |
| oos:ringcounter | 28 | 0.5% |
| oos:countlog | 26 | 0.5% |
| mutate-edit:remove | 26 | 0.5% |
| mutate-edit:theme | 25 | 0.5% |
| template:datereminder | 24 | 0.4% |
| edit-template:ledger | 23 | 0.4% |
| oos:habits | 18 | 0.3% |
| oos:scoreboard | 18 | 0.3% |
| oos:timer | 18 | 0.3% |
| oos:expenses | 16 | 0.3% |
| oos:stock | 16 | 0.3% |
| oos:todo | 16 | 0.3% |
| oos:ledger | 13 | 0.2% |
| mutate:quick | 10 | 0.2% |
| mutate-edit:chart | 9 | 0.2% |
| oos:datereminder | 6 | 0.1% |
| mutate-edit:remind | 5 | 0.1% |
| edit-template:datereminder | 2 | 0.0% |
| mutate-edit:quick | 1 | 0.0% |

### By request style

| value | n | share |
|---|---:|---:|
| detailed | 1122 | 20.5% |
| plain | 1078 | 19.7% |
| multi_feature | 944 | 17.3% |
| typos | 782 | 14.3% |
| short | 595 | 10.9% |
| custom_ui | 424 | 7.8% |
| vague | 366 | 6.7% |
| ask | 158 | 2.9% |

### Out-of-scope kinds

- messaging: 77
- sync: 70
- internet: 60
- camera: 23
- print: 23
- ai: 20
- other_apps: 12
- location: 9
- voice: 8
- other: 1

### Edit operations

- add: 459
- theme: 191
- hand-edit: 177
- remove: 145
- name: 93
- rename-app: 85
- param: 65
- note: 29
- chart: 9
- remind: 5
- quick: 1

### Domains: 1282 distinct

Top 25: ask (158), example (71), study_exams (22), q_Swim laps (21), q_Stairs (21), d_Business costs (21), d_Wedding (21), d_Pet costs (21), q_Coding (20), q_Daily spend (20), d_Household bills (20), d_Eating out (20), e_Movie list (20), e_Book lending (20), q_Coffee (19), q_Tea (19), q_Savings (19), q_Greens (19), q_Protein (19), q_Yoga (19), q_Baby milk (19), q_Vitamins (19), q_Gym time (19), q_Rainfall (19), q_Rosary (19)

Smallest: a3_trip_days (1), a3_e_tripdays1 (1), a3_eidi (1), a3_gym_pr (1), a3_e_pr1 (1), a3_chai_stall (1), a3_grocery_stores (1), a3_morning_routine (1), a3_flash_random (1), a3_e_flashr1 (1), a3_spend_plot (1), a3_pow_growth (1), a3_memory_pairs (1), a3_next_up (1), a3_e_nextup1 (1)

### Program tokens (planned tokenizer, target program)

mean 115.4, median 106, p10 50, p90 192, p99 285, max 387

### Request length (words)

mean 23.4, median 21, p10 5, p90 47, max 74

### Program kind

- programs using std shortcuts (form/list/quick/goal/stat/daybars...): 4027 (74%)
- programs with custom level-1 pieces (draw/grid/box/timer): 711 (13%)
- hand-written pairs (all hand-* methods): 1006 (18.4%)

