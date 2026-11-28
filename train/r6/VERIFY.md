# Round 6 data: verification

Seed r6a. Language commit 4698991 (checker, formatter, evaluator, diff in `ref/lang`), reference applier `ref/patch_ops_ref.mjs` (the app's, same as exp/patch_ops.mjs).
Built by `build_r6.mjs` (generators `gens6.mjs`, part names `blocks6.mjs`, judge `judge6.mjs`, filter `neg6.mjs`, wording `phrases6.mjs`); re-checked from the written files by `verify_r6.mjs` (this file).

## Re-check of the written files (independent of the builder)
| Set | Rows | All rules pass |
|---|---|---|
| train (`data/r6_train.jsonl`) | 5563 | 5563 |
| held-out eval (`data/r6_heldout.jsonl`) | 876 | 876 |

Rule failures after the re-check: train {}, held-out {}.
Rules per row: reference applier applies the ops; the result passes the checker (canonical form, loads, draws without an error node); the judge accepts it (change visible and matching the request, nothing else changed, names declared in the program); none of the four observed mistakes (below); ASCII only; no unfilled template slot; the ops touch only the changed lines; the result differs from the before program. Refusal rows (`none`, `ask "Molde apps cannot ..."`) are checked against their format.

## Rows per kind (train)
| Kind | Rows |
|---|---|
| add_chart | 938 |
| add_section | 127 |
| add_stat | 978 |
| cannot | 130 |
| delete | 908 |
| goalnum | 311 |
| move | 957 |
| noop | 140 |
| rename | 720 |
| rename_field | 354 |

Sub-kinds: add_chart/daybars+section 256, add_chart/daycount+section 160, add_chart/goalbars+section 46, add_chart/mbars+section 110, add_chart/share+section 162, add_chart/trend+section 204, add_section/form 59, add_section/list 68, add_stat/avg 80, add_stat/count 181, add_stat/last 62, add_stat/max 309, add_stat/sum 346, cannot/delete data for good 6, cannot/make sounds or play music 11, cannot/predict the future 10, cannot/print or make a pdf 14, cannot/send a whatsapp message 9, cannot/send an sms 17, cannot/send email 11, cannot/share with other people 9, cannot/translate text 7, cannot/use the camera 14, cannot/use the internet 7, cannot/use the location 15, delete/block 866, delete/hint 42, goalnum/goal 4, goalnum/setting 307, move/above 341, move/below 357, move/bottom 141, move/top 118, noop/absent 15, noop/already 125, rename/in_if 5, rename/plain 715, rename_field/few_lines 44, rename_field/many_lines 310.

Paraphrase styles per kind (train): terse / plain / casual / specific
| Kind | terse | plain | casual | specific |
|---|---|---|---|---|
| add_chart | 243 | 294 | 276 | 125 |
| add_section | 28 | 33 | 41 | 25 |
| add_stat | 278 | 319 | 267 | 114 |
| cannot | 37 | 29 | 36 | 28 |
| delete | 222 | 248 | 217 | 221 |
| goalnum | 84 | 68 | 74 | 85 |
| move | 223 | 256 | 239 | 239 |
| noop | 41 | 42 | 26 | 31 |
| rename_field | 81 | 92 | 100 | 81 |
| rename | 181 | 187 | 174 | 178 |

Distinct request texts in train: 5326 of 5563 rows. Apps (clusters of near-identical real programs) in train: 70; distinct before programs: 351; of them grown by earlier verified add-edits: rows 3520. Program length (lines) train: min 45, median 51, max 71.

## Rejected candidates (counted by the builder, before the final rows were written)
Candidates generated (train): {"train_programs":1062,"add_chart":13860,"add_stat":25373,"add_section":633,"move":119621,"delete":17630,"rename":3861,"goalnum":1162,"rename_field":1951,"cannot":1620,"noop":8549}.
| Kind / rule | Rejected (train) |
|---|---|
| add_chart / duplicate_spec_in_app | 88 |
| add_chart / judge: wrong position | 5 |
| add_chart / no_request_template | 146 |
| add_chart / over_token_limit | 5 |
| add_chart / request_does_not_name_the_target | 52 |
| add_section / duplicate_spec_in_app | 15 |
| add_section / no_request_template | 24 |
| add_stat / duplicate_spec_in_app | 7 |
| add_stat / judge: wrong position | 3 |
| add_stat / no_request_template | 260 |
| add_stat / over_token_limit | 6 |
| cannot / over_token_limit | 1 |
| delete / duplicate_spec_in_app | 54 |
| delete / no_visible_change | 5 |
| delete / over_token_limit | 6 |
| goalnum / duplicate_spec_in_app | 2 |
| goalnum / over_token_limit | 3 |
| move / judge: not right above the reference | 5 |
| move / judge: not right below the reference | 5 |
| move / no_visible_change | 1 |
| move / over_token_limit | 6 |
| noop / over_token_limit | 2 |
| rename_field / after_fails_checker | 4 |
| rename_field / duplicate_spec_in_app | 124 |
| rename_field / over_token_limit | 2 |
| rename / duplicate_spec_in_app | 93 |
| rename / over_token_limit | 6 |

| Kind / rule | Rejected (held-out) |
|---|---|
| add_chart / duplicate_spec_in_app | 36 |
| add_chart / judge: wrong position | 1 |
| add_chart / no_request_template | 17 |
| add_chart / request_does_not_name_the_target | 6 |
| add_section / duplicate_spec_in_app | 4 |
| add_section / judge: wrong position | 1 |
| add_section / no_request_template | 1 |
| add_stat / duplicate_spec_in_app | 13 |
| add_stat / judge: wrong position | 1 |
| add_stat / no_request_template | 33 |
| add_stat / over_token_limit | 3 |
| delete / duplicate_spec_in_app | 9 |
| goalnum / duplicate_spec_in_app | 1 |
| move / duplicate_spec_in_app | 2 |
| move / judge: not right above the reference | 1 |
| move / judge: not right below the reference | 2 |
| move / no_visible_change | 2 |
| move / over_token_limit | 1 |
| rename_field / duplicate_spec_in_app | 20 |
| rename / duplicate_spec_in_app | 21 |

Rules named above: `no_request_template` (no wording fits the slots, e.g. a position asked but the template has none), `no_visible_change` (the screen tree is identical before and after; applies to add, move and delete; not to rename and setting changes whose text only shows when data exists), `request_does_not_name_the_target`, `duplicate_spec_in_app` (the same edit spec more than twice in one app: variety cap), `judge: ...` (the result did not match the structural check, e.g. a move not at a block boundary / not right above or below the named block, an insertion at the wrong position), `after_fails_checker`, `neg_*` (a target with one of the four mistakes; none were produced by these generators, so 0).

## Negative filter (observed model mistakes)
Four rules, `neg6.mjs`: `unchanged_replace`, `reversed_range`, `invented_chart_args`, `truncated_expression`. Hits among the new r6 rows: 0 (the builder rejects before writing, and the re-check above found 0). The same filter runs over the old r5c rows in `mix_r6.mjs`; its counts are in the Mix section.

## Split by app, leak checks
- Apps: 92 open apps (clusters of programs sharing more than half of their lines); 70 train, 22 held-out (the split is by app: every variant of a held-out app is kept out of the training rows); 5 apps are reserved (they contain programs of the earlier test sets: failhunt long programs, 40 changes, heldout2) and used by neither.
- Held-out programs that also appear in train rows: 0. Highest line-set Jaccard between any held-out program and any training program: 0.11 (apps were separated at Jaccard 0.5).
- Held-out request texts that also appear verbatim in train: 41.
- Titles shared by a held-out and a training app (generic names, different programs): ["quick notes","daybook","the book","keeper","little helper","everyday","ledger","my corner"].

## Mix with the old r5c rows (`mix_r6.mjs`, `data/mix_report.json`)
| Step | Rows |
|---|---|
| r5c ops train rows in (build_5c.py ops) | 23,757 |
| dropped: edit answers with an observed mistake (neg6) | 2 (invented_chart_args); unchanged_replace 0, reversed_range 0, truncated_expression 0 in the old data |
| dropped: rows built from an app that is held out in the r6 eval (line overlap >= 80% or Jaccard > 0.5 with any variant) | 491 (all edit rows) |
| r5c rows kept | 23,277 |
| r6 rows added (train / val split by hash, 1 in 24 to val) | 5,334 / 229 |
| mix train / val | 28,611 / 1,260 (16,823 edit rows, 11,788 creates) |

The observed mistakes were the model's, not the old data's: the old data has none of unchanged replace, reversed range or truncated line, and 2 rows with a chart that has no data arguments (removed).

## Honest limits of the data
- **Long apps**: the corpora hold 1,013 distinct verified real programs of 45 to 90 lines, which are variants of only 97 real apps (92 open to us); almost all are 45 to 51 lines. Longer rows (to 71 lines) are real apps grown by 2 to 14 earlier verified add-edits (chart, stat, section); 3,520 of the 5,563 train rows are on grown programs. Nothing beyond 71 lines.
- **Thin kinds**: add section (127 train / 11 held-out; most tables already have a form and a list), rename of a label inside `if(...)` (5 train / 7 held-out: the corpus has few labels inside `if`; the other 715 renames are plain labels), goal number from a `goal` line (4 train; the other 307 are `setting` values), refusals (130 + 140), and `in_expr` (none).
- **Synthetic wording**: every request is a hand-written template filled with names from the program (4 styles, 8 to 12 templates each, plus lead and tail decorations); 5,326 distinct texts for 5,563 rows. Names taken from tables (for example `bought`, `rowlog`) sometimes give an odd plural ("rowlogs"). The held-out set contains 41 request texts that also occur verbatim in train (very short ones such as "rename kind to type").
- **Repeats**: the same edit spec appears at most twice per app; adds, moves and deletes on variants of one app share most of their lines.
