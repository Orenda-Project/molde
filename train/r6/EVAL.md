# Round 6 held-out long-app edit eval

## Definition
- **Set**: `data/r6_heldout.jsonl`, 876 changes on 22 apps that are NOT in the r6 training rows (split by app: an app is a cluster of near-identical real programs; every variant of it is kept out; the r6 training mix also removes old r5c rows built from these apps, see VERIFY.md and mix_report.json). 63 distinct programs, 45 to 65 lines (median 52); 525 rows are on programs grown by earlier verified add-edits (the corpus has almost no real programs over 50 lines).
- **Kinds** (rows): add_chart 171, add_section 11, add_stat 171, cannot 16, delete 133, goalnum 43, move 146, noop 23, rename 107, rename_field 55. Sub-kinds: add_chart/daybars+section 51, add_chart/daycount+section 21, add_chart/goalbars+section 8, add_chart/mbars+section 20, add_chart/share+section 29, add_chart/trend+section 42, add_section/form 7, add_section/list 4, add_stat/avg 13, add_stat/count 24, add_stat/last 10, add_stat/max 70, add_stat/sum 54, cannot/delete data for good 2, cannot/make sounds or play music 2, cannot/print or make a pdf 4, cannot/send a whatsapp message 2, cannot/send an sms 1, cannot/share with other people 1, cannot/translate text 1, cannot/use the camera 1, cannot/use the internet 1, cannot/use the location 1, delete/block 125, delete/hint 8, goalnum/setting 43, move/above 50, move/below 57, move/bottom 20, move/top 19, noop/absent 3, noop/already 20, rename/in_if 7, rename/plain 100, rename_field/few_lines 7, rename_field/many_lines 48.
- **Wording**: styles terse / plain / casual / specific from the same hand-written pools as training, plus 249 rows (28%) in an *unseen* style written only for the eval (different sentence shapes; never used in training).
- **Core subset** (`core:true`, 246 rows, at most 28 per kind, chosen by hash): what the baselines below were run on, because the full set takes hours on a laptop CPU. The full set is for the Spark-side run of r6.
- **Each case**: before program (numbered in the prompt, as trained), request, reference ops (`answer`), and a `spec` that `judge6.mjs` uses. A case is **good** when the answer applies, the result passes the checker, the change is visible and matches the request (right table and field names declared in the program, right place, right words/number), and no other line changed. Refusal cases (`cannot`: must be an `ask "Molde apps cannot ..."` line; `noop`: must be `none`) are scored by format.
- **Scorers**: (1) *plain*: `score_r6.mjs` (reference applier + checker + judge, greedy, no app rules; same recipe as the r5 plain scorer); (2) *app flow*: `eval_gen.mjs` makes the raw answers with the app's own `generateOps`, then `app_flow_r6.mjs` feeds them to the Dart harness (`app_path_measure_test.dart`: real MoldeController, direct paths first, Dart applier, safety steps, page checker) and judges the program the app would really run. Refusal cases are not in the app-flow number (the app shows its own ask UI).
- **Machine**: laptop CPU, 4 threads, llama.cpp b12144, Q4_K_M, greedy, 4096 context, no grammar (the app's ops path). The machine was shared (load average 3 to 30 during the runs), so seconds are only indicative.

## Baselines on the core subset (plain scorer)
| Model | Cases | Good | Valid | Unchanged | Observed mistakes in the raw answers | Median s |
|---|---|---|---|---|---|---|
| r3-grammar | 51 | 0/51 (0%) | 18 | 0 | {"unchanged_replace":0,"reversed_range":0,"invented_chart_args":0,"truncated_expression":0,"not_an_op_list":0} | 13.06 |
| r3-raw | 61 | 0/61 (0%) | 20 | 0 | {"unchanged_replace":0,"reversed_range":0,"invented_chart_args":0,"truncated_expression":0,"not_an_op_list":0} | 12.95 |
| r5c-ops-ep3 | 247 | 86/247 (35%) | 215 | 6 | {"unchanged_replace":18,"reversed_range":1,"invented_chart_args":0,"truncated_expression":2,"not_an_op_list":1} | 3.14 |

Per kind (good / cases on the core subset; full set size and core size in columns 2-3):
| Kind | Full set | Core | r3-grammar | r3-raw | r5c-ops-ep3 |
|---|---|---|---|---|---|
| add_chart | 171 | 28 | 0/6 (0%) | 0/6 (0%) | 10/28 (36%) |
| add_section | 11 | 11 | 0/2 (0%) | 0/2 (0%) | 0/11 (0%) |
| add_stat | 171 | 28 | 0/6 (0%) | 0/7 (0%) | 11/28 (39%) |
| cannot | 16 | 16 | 0/3 (0%) | 0/4 (0%) | 2/16 (13%) |
| delete | 133 | 28 | 0/2 (0%) | 0/4 (0%) | 19/29 (66%) |
| goalnum | 43 | 28 | 0/9 (0%) | 0/11 (0%) | 27/28 (96%) |
| move | 146 | 28 | 0/9 (0%) | 0/12 (0%) | 5/28 (18%) |
| noop | 23 | 23 | 0/3 (0%) | 0/3 (0%) | 0/23 (0%) |
| rename | 107 | 28 | 0/8 (0%) | 0/8 (0%) | 10/28 (36%) |
| rename_field | 55 | 28 | 0/3 (0%) | 0/4 (0%) | 2/28 (7%) |

By program size and wording style:
| Model | 45-54 lines | 55+ lines | original | grown | terse | plain | casual | specific | unseen |
|---|---|---|---|---|---|---|---|---|---|
| r3-grammar | 0/36 (0%) | 0/15 (0%) | 0/25 (0%) | 0/26 (0%) | 0/6 (0%) | 0/12 (0%) | 0/7 (0%) | 0/8 (0%) | 0/18 (0%) |
| r3-raw | 0/42 (0%) | 0/19 (0%) | 0/29 (0%) | 0/32 (0%) | 0/7 (0%) | 0/14 (0%) | 0/9 (0%) | 0/10 (0%) | 0/21 (0%) |
| r5c-ops-ep3 | 60/166 (36%) | 26/81 (32%) | 39/114 (34%) | 47/133 (35%) | 15/40 (38%) | 20/50 (40%) | 14/47 (30%) | 18/39 (46%) | 19/71 (27%) |

## Baselines through the app flow (core subset, edits only)
| Model | Cases | Route direct / model / none | Good edits | Applied but wrong |
|---|---|---|---|---|
| r3-grammar | 51 | 3 / 48 / 0 | 3/45 (7%) | 1 |
| r3-raw | 61 | 3 / 58 / 0 | 3/54 (6%) | 1 |
| r5c-ops-ep3 | 247 | 6 / 235 / 6 | 82/208 (39%) | 87 |

r3 writes whole programs (its own format; the app wraps it in a line-by-line grammar loop, which the plain numbers do not). Two plain variants on a core subset (whole-program answers are slow on CPU, so not all 246): **r3-raw** = greedy with no grammar (r3 was trained on the language before round 14 and often writes `bar T, ...` for `topbar`, so most answers fail the checker), **r3-grammar** = the same with the language grammar (`ref/lang/moldescript.gbnf`) as in the earlier r3 load tests. The app-flow rows use the same raw answers. r5c-ops ep3 is the pick of round 5 (`runs/r5c-ops/gguf/r4-r5c-ops-ep3-Q4_K_M.gguf`). r3 never saw `none` / `ask` refusal targets for edits in this form, so its refusal cases are not meaningful.

## Caveats of this eval
- Held-out apps are real programs of the earlier corpora; the earlier models (r3, r5c) were trained on rounds that contained variants of these same apps (the r6 mix removes them, the baselines were not retrained). The baselines are therefore, if anything, favoured.
- 22 apps, 64 programs, but 28 cases per kind on the core subset: a kind score moves by 3.6 points per case; use paired comparisons on the same cases and the full 876 rows for the r6 run.
- The judge is structural (it does not render pixels); it accepts any chart of the asked family that uses the named table and field, and requires an exact position only when the request names one.
- The rename-in-`if(...)` kind has only 7 held-out cases (the corpus has few labels inside `if`); add-section has 11.
