# Failure hunt: Gemma create and edit on new requests (2026-11-26)

## Setup

- **Models:** Gemma r3 (the app's model) and r4 Gemma ep2 (comparison), both Q4_K_M.
- **App path:** each model runs through the app's own `decode_loop.mjs` (arm E, host `core_server` from `molde_core.h`, llama.cpp b12144). On top of that runs a hand port of `rules.dart`: the no-ask rule, direct edits, the 20% and unasked-removal guards, and the data-safety check.
- **Test set:** 407 new creates (18 dropped as near-duplicates of v3.1) and 148 chains with 686 steps. 28 of the chains run on the 7 long hand-written demo programs. sha256 is in `cases.sha256`. Never train on this set.
- **Hand reading:** all 407 r3 creates, about 250 r3 edit results and 147 r4 creates.
- **Qwen:** not run; its column comes from `r4/REPORT.md`, which used a different, smaller test.
- **Speed:** Spark CPU with 4 threads, not phone speed.

| | r3 Gemma | r4 Gemma ep2 | Qwen 0.8B ep1 / ep2 (other test) |
|---|---|---|---|
| Create: checker pass | 357/407 = 87.7% | 367 = 90.2% | heldout2 94.6 / 98.0% |
| Create: asks (no-ask rule on) | 0/407 | 0 | 11.7 / 16.7% (rule off) |
| Create: did what was asked, strict (hand) | **150 = 36.9%** | 28% (r3 36% on the same 147) | not measured |
| Create: right kind of app at least | 70.8% | not fully labelled | not measured |
| Create: English / Roman Urdu + mixed (strict) | 42% / **25%** | 37% / 22% | not measured |
| Create: blind A/B, 30 English pairs both passing | **wins 19** | wins 9, ties 2 | |
| Edit via the model, right | 82/321 = **25.5%** | 88/358 = 24.6% | 40 small changes: 22 / 25 right |
| Edit: short chains / long programs (40 to 89 lines) | 32% / **1 of 70** | 30% / 1 of 70 | |
| Edit returned the program unchanged | 39% | 45% | |
| App's own colour, dark, title, size and "change goal to N" | 74/74 | 81/81 | |
| Median seconds per create / per model edit | 1.45 / 1.0 | 1.83 / 1.1 | 4.3 / 11 (laptop) |
| Native core hangs (90 s, no output) | 1 | 2 | |

Edits by kind on the model path (right / tried):

| kind | r3 | r4 ep2 |
|---|---|---|
| add field | 16/68 | 19/74 |
| add option | 0/13 | 0/16 |
| rename button | 6/34 | 19/40 |
| rename field (needs `was`) | 3/28 | 2/29 |
| remove one thing | 0/23 | 4/27 |
| reorder | 0/6 | 0/10 |
| add chart | 23/41 | 22/45 |
| add stat | 16/43 | 14/46 |
| sections | 4/29 | 0/33 |
| goal wording not caught by the app | 9/27 | 6/28 |

- **Ceiling:** r3's programs have a median 0.32 of the hand-written demos' line count. Water is 8 of 27 lines, todo 10 of 44, journal 15 of 60.
- **r4 is not better than r3.** v3.1 adds unrelated settings and prices to small apps ("Budget per day" in a to-do, "Price per ml" in a baby log). Leaks on the 147 paired requests: r3 4, r4 ep2 9.
- **Roman Urdu and typos are a data gap, not a size limit.**
  - r3 on the English translation of the 81 Roman Urdu and mixed requests: right topic 79/81, checker pass 79/81. On the Roman originals: right topic about 47%, checker pass 65/81.
  - Typos corrected: right topic 23/23.
  - v3.1 has only 5 Roman Urdu creates out of 14,644.
- **Decoder budget:** 12 tries per line fixed 9 of the first 26 failed creates.

## Create failures, ranked by frequency × harm

| rank | class | n | root cause |
|---|---|---|---|
| 1 | Checker failure (9 loop into 25–57 lines of garbage) | 50 | capacity + decoder |
| 2 | Formulas that pass the checker but are nonsense | 62 | capacity + data |
| 3 | Misses an explicit specific | 55 | data + capacity |
| 4 | Roman Urdu or mixed request builds an unrelated app | 27 zero (81 requests, 25% strict) | data |
| 5 | Wrong topic for an English request | 17 | data + capacity |
| 6 | Unsupported request built as if supported | 11 (15 requests, 0 refused) | app + data |
| 7 | Text leaked from another app | 13 | data |
| 8 | Typo makes it an unrelated app | 4 | data |
| 9 | Absurd default number | 5 | data |
| 10 | Too thin | 4 | data |

## Edit failures (321 model-path steps in r3; r4 ep2 alongside)

| class | r3 | r4 ep2 | root cause |
|---|---|---|---|
| Unchanged | 39% | 45% | data + decoder |
| Checker failure | 11.5% | 8.7% | capacity |
| Long program damaged | 7.5% | 10.3% | capacity |
| Applied wrong | 9.7% | 7.5% | data + capacity |
| Collateral damage on short programs | 3.4% | 2.2% | capacity |
| Guard false positive | 1.6% | 0.6% | app |
| Rename refused without `was` | 1.2% | 1.1% | data + app |
| Native hang | 0.3% | 0.3% | core |

## What fixes what

- **Model size probably fixes:** checker failures, nonsense formulas, and exact copying of long programs.
- **Data must fix:**
  - Roman Urdu, typos, leaks and unsupported requests;
  - rare edit kinds. v3.1 has only 4 add-option pairs, 1 rename-button pair and 0 reorder pairs on programs of 12 lines or fewer.
- **App must fix:** the guards, the direct-edit wordings and the hang (see APP_BUGS.md).

## Rubric and judge

- **Creates:**
  - 2 = right kind of app, every explicit specific present and working, nothing unexplained;
  - 1 = right kind but a specific is missing or a number, formula or label is wrong;
  - 0 = wrong app, checker failure or garbage.
- **Edits:** scored by machine predicates plus a hand read of every changed step.
- **Raters:** one.
- **Automatic judge (features only):** strict agreement with the hand labels 68.6% (kappa 0.39), lenient 82.6%. It does **not** rank models yet: it agrees with the blind A/B picks only 15 of 28. The plan to make it a real gate is in DATA_SPEC_r5.md.

## Limits

- One rater, and the hunter wrote the test set itself.
- r4 ep2 is only partly hand-labelled.
- The app rules are a JS port of the Dart code, so APP_BUGS items 3–5 need confirming in the real app.

## Corrections after the critic (second pass)

### 1. Identical edit outputs: model behaviour, not a harness bug

- **How common.** Of 414 r3 model-path outputs, 232 (56%) are byte-identical to the output of a *different* request (r4 ep2: 272 of 458, 59%). The critic's 264 of 488 also counts the vague, refuse and undo steps.
- **Why.** 154 of the 232 are the unchanged program: several requests on one program all come back untouched. The other 78 are one *changed* program returned for several requests: 42 on the long programs (one damaged copy for every request) and 36 on short ones (for example h017's collapsed 5-line program).
- **Proof that it is not a cache or a missing request.** `controls/identical_outputs_proof.txt`: 12 groups (6 changed-output, 6 unchanged), 39 steps, each replayed with the model process **restarted before every case** (no KV cache or tokenisation state can carry over). All 39 prompts contained their own `Edit request: <request>`; within each group the prompts have different md5s and the outputs are one program; 37 of 39 outputs are byte-identical to the original run. The forced suite below logged the same: the request was in the first prompt in every run (704 of 704 in the first version).
- **Consequence.** The unchanged and collapsed outputs are the model ignoring the request. The edit numbers stand; what changes is the explanation (section 4 of the report was already about this class).

### 2. Chain steps that never ran, and the denominators

| | r3 | r4 ep2 |
|---|---|---|
| planned steps | 686 | 686 |
| never started (the seed create failed; 16 / 6 chains) | 78 | 30 |
| in runnable chains | 608 | 656 |
| **not applicable** (the program had no part to change) | **120** | **117** |
| run | 488 | 539 |
| direct (the app's own edit, no model) | 74 | 81 |
| through the model | 414 | 458 |
| of which definite kinds (the 321 / 358 of the tables), vague, refuse, undo | 321 / 49 / 33 / 11 | 358 / 52 / 38 / 10 |

Not applicable by reason (r3): one of the two parts missing 33, no choice field 32, already in that order 13, no chart/stat/goal/list to remove 26, nothing to undo yet 8, no button 7, no table 1. By kind: reorder 46 of 52 planned steps, add option 32 of 45, remove 26, undo 8, button 7. The chain generator picked kinds at random without looking at the program, so most reorder and add-option steps had nothing to act on: the earlier "reorder 0 of 6" and "add option 0 of 13" were tiny samples.

**Fix: a forced suite (version 2, after the critic's second round).** `tools/make_forced.mjs` and `tools/make_forced_v2.mjs` build steps that are applicable by construction from the r3 create results, and that fit the app: 46 add-option steps (only for a choice whose option set is a known family and the new option belongs to it: Sat after Mon to Fri, Before_meal after Fasting, After_meal, Bedtime, Urdu after the school subjects; no "Urgent" in a blood-sugar app), 40 button renames (the label occurs exactly once in the program), 125 removals (chart or list that exists once, or the program's only number element, so "the totals" has one referent), 85 reorders (a form or chart moved to the wrong place and asked to go back; the start state is checked not to satisfy the predicate). Every step's target is verified by `tools/check_forced.mjs` (22 steps worded "take away the total" had no total in the program, were reworded and rerun). Cases `controls/forced_cases.jsonl` (296), results `results/forced-r3.jsonl`, `results/forced-r4ep2.jsonl` (the first, context-blind version is kept as `*-v1-*`), table `controls/forced_v2_summary.txt`.

| forced suite v2 (right / tried) | r3 | r4 ep2 |
|---|---|---|
| add an option | 4 / 46 (unchanged 41) | 2 / 46 (unchanged 43) |
| rename a button | 10 / 40 (unchanged 25) | **31 / 40** (unchanged 1) |
| remove one thing | 1 / 125 (unchanged 78, blocked by a guard 42, of which the model's output was right 21) | 19 / 125 (unchanged 60, blocked 44, of which right 36) |
| reorder | 11 / 85 (unchanged 73) | 26 / 85 (unchanged 43) |
| **all 296** | **26 (9%)**, unchanged 217 (73%) | **78 (26%)**, unchanged 147 (50%) |

What this changes: add option is the worst kind in both models (4 and 2 of 46); v3.1 helps button rename most (r3 10 to r4 ep2 31 of 40) and reorder; and the guard blocks right removals (21 and 36): **APP_BUGS #3 is larger than the 3 cases first counted**; with the guard fixed r4 ep2's remove would be 55 of 125 (44%) instead of 19. The context-blind first version (352 steps) gave 23 (7%) and 83 (24%) overall; the ranking of the kinds did not change.

### 3. Classes added to the taxonomy

- **Silent change of an untouched line, guards say "safe"** (critic item 5). `python3 tools/silent_rewrite.py`: 8 of 119 applied model steps in r3 (6.7%), 2 of 134 in r4 ep2. h061 step 4 ("add a priority") removed `where done = no` from a loop; L023 step 1 and L024 step 2 rewrote the `let mon(d date) = ...` formula; L022 step 3 rewrote a chart line. Root cause: capacity + a guard that counts lines (APP_BUGS #12).
- **Collapse onto a memorised skeleton on an unfamiliar request** (critic item 8). r3: a quiz skeleton for a non-quiz request 2 (c350 "ai chatbot", c287 "gradebook"), a mosque or beads app for a non-religious request 6 (c086, c095, c114, c117, c328, c367), a ring counter for a request that did not ask to count 6 (c070, c104, c114, c225, c242, c341): 14 of 357 builds (3.9%). r4 ep2: 0 quiz, 4 mosque, 0 ring counter (4 of 367). 64 r3 builds (18%) share an identical body with another request, most of them the 3-line table + form + list app, which is legitimate for short requests; `tools/collapse_stats.mjs`.
- **Label contradicts value** (critic item 6, create side): c074 (an average per night labelled "per week"), c061 (a percent stat missing its /100), c296 (the first "profit" stat shows sales), c188 and c049 (two labels over one formula). Counted inside class 2 (nonsense formulas); a plan line with a total per week or per night would flag it.
- **A button that does not do what it says** (critic item 7): c281 "Check" adds one with no comparison, c350 builds a quiz with a nonsense `each` line. Also class 2.
- **Leak named** (critic open point): c215 "score keeper for two teams" has the title "Quiz night" and the team names `Table_1` and `Table_2`.

### 4. Estimates withdrawn

The earlier create target of 55 to 62% and edit target of 55 to 65% were sums of unmeasured estimates and are withdrawn. What the evidence supports is a baseline, not a target: a **hypothesis (H9) of about 45% create strict from data alone**, which no run has tested. Measured baselines: r3 strict 36.9% overall and 42% on English-only requests (a baseline, not a ceiling), and 9 of 26 checker failures recover with 12 tries per line. Anything above that, and every edit target, is a hypothesis for experiments R5-A (new data, patch edits) and R5-B (the same data, full-program edits) to test. The measured baseline for edits is 25.5% overall, 32% on short programs, 1 of 70 on long programs (r3), and 9% on the forced suite (r3), 26% (r4 ep2). DATA_SPEC_r5.md section 5 is rewritten as "measured" against "hypothesis" and its gate asks for 45% first (H9).

### 5. The spec was checked for test leakage and skeleton reuse

- First version: 62 of 81 spec items had a request equal or near-equal to a test request (`tools/leak_check.mjs`: exact, then word-set Jaccard 0.75, 0.6 for requests of five words or fewer; against every test create request, chain seed request and chain step wording), and 3 program shapes (water, spending, to-do) held 27 of 72 items (`tools/skeleton_check.mjs`).
- Rewritten: every request is new, every program has its own shape, no shape appears more than twice. Current result: 76 examples, 0 leaks, 74 programs (an ask pair and its follow-ups count one program) in 56 shapes, 0 over the cap; all programs pass the checker and the formatter form, edits also the data-safety diff and a does-what-asked predicate, and the 7 plan lines pass the plan check. Both checks are build rules in DATA_SPEC_r5.md section 0.
- Refusals and vague requests (second-round redesign): an edit that asks a question must never destroy the program. The model's whole answer is one `ask` line; **the app shows it and keeps the current program unchanged** (`controller.dart` `_afterGenerate`: an ask result sets `pendingAsk` and returns before anything is applied; `answerAsk` then re-runs the edit over the same program with `Question:` and `Answer:` lines). The spec rows say so explicitly (`kind: edit_ask`, field `app_effect`), and `tools/validate_asks.mjs` checks each ask pair: one valid ask line, program kept by construction, and follow-up rows (same request, same program, same question, answer one of the choices). 4 ask pairs and 7 follow-up pairs are in `spec/edits.jsonl` (declining choices such as "Leave it as it is" need no model call: an app-side rule). The earlier identity pairs and the replacement-by-ask rows are gone.

(The hunter agent wrote the first part of this report; the coordinator saved it to this file, because the agent could not write it. Section "Corrections after the critic" was added by editing this file.)

### 6. Edit data format: patch operations

Following the trainer's experiment (E1, edits as patch ops, 1 epoch on v3.1, 40 changes: lost lines 422 to 38, checker pass 28 to 33, good 14 to 17, not yet conclusive), all r5 edit data is specified in the patch format of `exp/patch_ops.mjs` (reference copy `tools/patch_ops_ref.mjs`): numbered program in the prompt, `insert after` / `replace` / `delete` / `move` operations with `+ ` payload lines as the answer, whole programs derived by applying them. Every edit row in `spec/` carries `answer` (the operations) and the builder fails if applying it does not give `program`. DATA_SPEC L1 and E1 to E11 are written that way; the ask answer in a patch-format edit is one ask line and the app keeps the program.

Third-round closes: decline answers are an app rule (APP_BUGS #14, `tools/validate_asks.mjs` names them); `results/README.txt` documents every raw file including `forced2-*` (the 131 rebuilt steps, merged into `forced-*`); rq2 now has its follow-up row (rq4); the critic's note on rq3 was a misread, rq3 carries its Question/Answer lines.
