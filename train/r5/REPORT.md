# Round 5 report (2026-11-27)

Verdict: not ready. Best model r5c-ops epoch 3 builds exactly what was asked on new requests 26-28 of 60 (43-47%) by hand, against a 60% bar. Edits pass the 50% bar in the plain test.

## Edits (plain greedy test, no app rules; 40 changes / 321 chain steps / 296 forced)

| Run | Changes /40 | Chain /321 | Forced /296 |
|---|---|---|---|
| r3 (in app) | 14 | 74 | 43 |
| r5b-whole ep3 | 22 | 166 | 162 |
| r5b-ops ep1/2/3 | 24/26/29 | 165/176/174 | 196/204/221 |
| r5a-p ep3 | 20 | 115 | 134 |
| r5c-ops ep3 | 25 | 181 | 218 |
| r5c-mix ep3 | 25 | 165 | 156 |

Patch ops beat whole rewrite at every epoch. Long programs: 30 of 82 chain steps right (r3: 3). Still weak: add section 9/29, goal number 6/27, rename field 4/28, reorder 2/6.

## New apps (hand labels, same random 60 of 407)

| Model | Builder exact | Critic exact | Critic wrong |
|---|---|---|---|
| r3 | 21 | 22 | 18 |
| r5a-p ep2 | 25 | 19 | 16 |
| r5b-ops ep2 / ep3 | 14 / 18 | 12 / 19 | 27 / 24 |
| r5c-ops ep3 | 28 | 26 | 11 |

An independent critic labelled blind and agreed with the builder on 80-92% of requests. r5c-ops vs r3 on exact is within noise at n=60 (paired 12 vs 8, p about 0.5). The signal that holds: fewer wrong builds (11 vs 18). Seven of r5c-ops's 11 wrong fail to load (type errors, duplicate or undeclared names, missing required field).

## Pick
r5c-ops epoch 3 (`~/kamal/molde/runs/r5c-ops/gguf/r4-r5c-ops-ep3-Q4_K_M.gguf`). r5c-mix (a third of the new edit rows) is no better; full data stays.

## Not done
- The app cannot apply patch ops or plan-first creates yet, so none of this reaches the phone.
- No phone speed measurement. No teacher pairs added (no critic sample).
- Need a larger create comparison (200+) with a second labeller.

## Next
1. App: apply patch ops and the plan decoder (applier exp/patch_ops.mjs).
2. Fix load failures (ASCII-only strings, name and type checks, missing named totals).
3. More English hand creates around the misses; then a bigger blind test.

Files: `r5/` (scoring scripts, sample60.json, labels, critic_labels*.json, out/), Spark `~/kamal/molde/runs/<run>/gguf/` (every epoch kept).
