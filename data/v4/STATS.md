# Molde data v4 (Gemma round 5)

Language commit 4698991 (round 14). Built from v3.1 by cleaning (spec section 2), deriving `# need:` plan lines and patch-op answers for every row, and adding hand-written rows. Verifier: uncached (`NOCACHE=1`), `gen/verify4.mjs`.

## Result

| Check | Result |
|---|---|
| Rows | 18,122 (11,806 create, 6,316 edit) |
| verify.log | 18,122 / 18,122 pass (migrate, check, canonical, eval, tokens, diff-safe, patch round-trip, plan coverage, ask rows) |
| leak_check (whole v4) | 0 leaks (also checked heldout2, 40-changes, 60-asks sets, forced/cases/controls programs) |
| skeleton_check, new hand rows, cap 2 | 390 programs, 239 skeletons, 0 over |
| skeleton_check, whole set | 17,923 programs, 6,650 skeletons; none over 40, 10 shapes over 10, 2 over 15 (v3.1-derived, see below) |
| Tokens | mean 204, median 155, p90 527, max 749 (limit 500, 900 for long) |

## Counts per class

| Class | Rows | Note |
|---|---|---|
| creates with plan line | 11,337 of 11,806 | plans derived from request + program, verified by plan_check coverage; 469 creates have none (mostly asks / one-word) |
| edits, short programs | 3,387 | all with whole program + patch-op answer, round-trip exact |
| edits, long programs | 2,929 | v3 long edits, carried, patch form |
| ask rows (create and edit) | 470 | ask answer leaves program unchanged; follow-up rows (Question/Answer -> real result) included |
| new hand edits (v4) | 278 | add option 68, remove 36, rename button 32, rename field 30, add field 29, setting value 27, add chart/stat 20, reorder 19, sections 17 |
| new hand creates (v4) | 128 | Roman Urdu 64, cannot-do plain asks 32 (+12 with follow-up), typo/one-word 14, vague asks 6 |
| from v3.1 (cleaned) | 17,716 | |

## Removed from v3.1 (21,668 -> 17,897) and why

| Reason | Rows |
|---|---|
| template-shaped rows | 1,291 |
| long request, thin program | 215 |
| rows with leaked labels | 28 |
| colour/dark/title/goal-style edits (APP_BUGS #5 not fixed, so 300 unusual-wording ones kept) | 597 of 897 |
| duplicate program bodies (more than 3 per body) | 357 |
| family caps (ring counter, point/team scoreboard, mosque beads: 120 each) | 378 |
| over 15 per app title (creates) | 905 |

Assembly then dropped 89 rows whose program equals a test program, 9 duplicate requests, 78 leak-check hits, 15 near-duplicates of the heldout2 / 40-changes / 60-asks sets, and 9 over the title cap.

## Not met (honest list)

- Volume of new hand-written rows is 406, far below the roughly 10,000 the spec implies. The rest of the set is cleaned v3.1.
- Roman Urdu / mixed / typo creates: about 78 hand rows plus whatever v3.1 held, well under 10-15% of creates (target 1,200-1,800).
- C2 execution-gated calculators, C4 repair pairs, C7, C8 and most of C3 (keep-specifics) have little or no new coverage.
- Long-program edits of the near-zero kinds (add option, remove, reorder, rename, sections) are covered only on short programs (4-25 lines); long ones are v3 carry-overs.
- Whole-set skeleton cap is not 2: v3.1-derived rows have 10 shapes above 10 programs each. The cap of 2 holds only for the new rows.
- One decision file entry failed (e-option-01 b0393f8a2, wrong line index) and was dropped.

## Defaults used (no questions asked)

Title cap 15 per app title; family cap 120; leak thresholds as in leak_check (Jaccard 0.75, 0.6 for 5 words or fewer); ask edits carry the ask line as program, with the original program in `program_before`.

## v4.1 snapshot (running)

v4.1.jsonl = v4 (18122 rows) + 572 new verified rows = 18694. The new rows pass the uncached verifier (100%), leak check 0 and the patch round-trip.

Roman Urdu / mixed / typo creates (hand, class roman_urdu or typo_short): 201 total (target 1,200).

| New class | Rows |
|---|---|
| add_option | 115 |
| cannot_do_ask | 10 |
| long_base | 6 |
| remove_one | 89 |
| rename_button | 101 |
| rename_field | 43 |
| reorder | 50 |
| roman_urdu | 106 |
| sections | 25 |
| typo_short | 17 |
| vague_ask | 10 |

Hand edits, cumulative (v4 + v4.1), long programs (more than 25 lines): {'remove_one': 49, 'rename_button': 50, 'add_option': 58, 'sections': 21, 'rename_field': 38, 'reorder': 27, 'vague_ask': 10, 'cannot_do_ask': 10}
Hand edits, cumulative, short programs: {'add_option': 125, 'rename_field': 35, 'rename_button': 83, 'cannot_do_ask': 12, 'add_field': 29, 'sections': 21, 'add_chart_stat': 20, 'remove_one': 76, 'reorder': 42, 'setting_value': 27, 'vague_ask': 6}


## b2 (edits on long programs, asks; prefix b2-)

Added by gen/b2_build.mjs + gen/assemble_b2.mjs from hand/b2-*.txt (anchored decisions, base programs also become creates). English only. Verified uncached (111 of 111), leak 0.

| Class | Size | Rows |
|---|---|---|
| add_option | long | 15 |
| cannot_do_ask | long | 10 |
| long_base | long | 6 |
| remove_one | long | 16 |
| rename_button | long | 18 |
| rename_field | long | 18 |
| reorder | long | 9 |
| sections | long | 9 |
| vague_ask | long | 10 |

Not met so far: 9 of 120 long bases written (6 survived title cap and leak check as creates); short-program edits, 160 asks and 300 calculators not started.


## a2 (creates; prefix a2-)

Hand-written one program at a time into hand/a2-c-*.txt, built by gen/build_creates.mjs (also reads a2-c-*; env ONLY=prefix probes without writing hand_creates.jsonl), skeleton cap checked by gen/a2_skel.mjs (cap 2: 0 over). Verified uncached (694 of 694 in new41, 233 of them a2), leak 0. Delta: out/newa2.jsonl.

| Class | Rows |
|---|---|
| keep_specifics | 76 |
| rich_app | 6 |
| roman_urdu | 120 |
| sensible_calc | 16 |
| typo_en | 6 |
| typo_short | 9 |

Direction change mid-run (Kamal): Roman Urdu stopped at 129 surviving rows (target 1,000 not met). Priority became English creates with many specifics, sensible calculators, English typo requests, richer apps. About 15% of written rows were dropped by the leak, duplicate and title-cap steps (short typo requests most).

Not met: English specifics 76 of 1,200; sensible_calc 16 of 600; typo_en 6 of 200; rich_app 6 of 300. Do not run gen/snap41.py: it cuts STATS.md at the v4.1 snapshot heading and would delete the b2 and a2 sections.


## c2 (computed edits on real programs; prefix c2-), revision 2 after the critic

Built by gen/c2_edits.mjs (parse the base with lang parse.mjs, propose edits, compute the after-program, gate) and gen/assemble_c2.mjs (lock, dedupe, leak rounds, replaces all earlier c2- rows, appends). Option families gen/c2_families.mjs (241), wording gen/c2_words.mjs + gen/c2_words2.mjs, audit gen/c2_audit.mjs. English only. 5,920 rows from 2,281 real base programs (396 long bases: long creates plus the "before" programs of existing long edits). Revision 2 replaced the 3,998 rows of revision 1.

Gates (all re-run on the 5,920 rows): verify4 uncached 5,920 / 5,920 (patch round-trip, data-safety diff, tokens max 725, CLI check and format sample clean); leak_check 0 leaks; at most 4 edits per base and 2 of one kind (max 4 and 2); only the intended lines change (patch ops checked against the touched set; reorder checked as a permutation); hand review in C2_REVIEW.md.

| Class | Short | Long | Total | Long share |
|---|---|---|---|---|
| remove_one | 297 | 153 | 450 | 34% |
| reorder | 297 | 153 | 450 | 34% |
| rename_button (buttons, form buttons, titles, section and tab labels) | 297 | 153 | 450 | 34% |
| rename_field (with `was`) | 336 | 114 | 450 | 25% |
| add_option (append 56%, at a named place 44%) | 410 | 40 | 450 | 9% |
| setting_value (goal, range, quick, time, timer, target) | 299 | 151 | 450 | 34% |
| sections (wrap one thing, split the screen) | 359 | 91 | 450 | 20% |
| add_field (by reversal) | 437 | 83 | 520 | 16% |
| add_stat (stat, stat card, goal bar; also a section holding one) | 332 | 188 | 520 | 36% |
| add_chart (daybars, goalbars, trend, share, bars, heat, daygrid, weekdots; also a section holding one) | 332 | 188 | 520 | 36% |
| add_list (list; section holding a described stat, chart or list) | 332 | 188 | 520 | 36% |
| add_reminder (by reversal) | 507 | 13 | 520 | 2.5% |
| no_change (answer `none`) | 112 | 58 | 170 | 34% |
| Total | 4,347 | 1,573 | 5,920 | 26.6% |

New kinds by reversal: a real program P that has the thing is cut cleanly to P' (nothing else references it, program still checks and evaluates), then before = P', request = "add <the thing described by name, type, range, unit, options, or by what the stat/chart shows>", after = P. The description is generated from the parsed line and must rebuild the line exactly (fields: name, type, optional, range, default, label, unit; stats and charts: aggregate, table, field, window, filter, caption, target, peak; reminders: text, times, days, interval). A position clause names the neighbour ("above the X card", "at the top", "after the Y field") unless the thing is last. Reminders draw nothing, so their place is defined: right after the last declaration at the top; P is normalised once (reminder moved there) in 434 rows, marked meta.normalized.

Target line of the first operation (histogram, line numbers of the before-program):

| Kind | line 2 | 3 | 4 | 5-6 | 7-10 | 11-20 | 21+ | share on line 3 or later |
|---|---|---|---|---|---|---|---|---|
| add_option | 157 | 231 | 31 | 28 | 3 | 0 | 0 | 65% |
| rename_field | 157 | 231 | 46 | 16 | 0 | 0 | 0 | 65% |
| add_field | 181 | 266 | 50 | 22 | 0 | 1 | 0 | 65% |
| rename_button | 228 | 13 | 18 | 17 | 41 | 106 | 27 | 49% |
| remove_one | 72 | 13 | 7 | 36 | 106 | 143 | 73 | 84% |
| setting_value | 164 | 119 | 44 | 86 | 19 | 16 | 2 | 64% |
| sections | 0 | 27 | 57 | 127 | 114 | 58 | 67 | 100% |
| reorder (the move is written on the block that moves less) | 0 | 7 | 24 | 61 | 89 | 178 | 91 | 100% |
| add_stat | 0 | 45 | 88 | 117 | 116 | 48 | 106 | 100% |
| add_chart | 0 | 1 | 26 | 79 | 158 | 132 | 124 | 100% |
| add_list | 0 | 1 | 19 | 73 | 158 | 128 | 141 | 100% |
| add_reminder | 0 | 273 | 107 | 131 | 9 | 0 | 0 | 100% |

(rename_button is mostly app-title edits on line 1 or 2 by nature.) add_option, rename_field and add_field are held at 65% or more on line 3 or later by the selection (an early-line candidate is skipped while the late share would drop under 65%).

"first", "top", "last", "bottom": first = before the first visible statement of the container (the app bar, declarations and reminders do not count); last = after the last visible statement. Programs whose first visible statement is a text line (title-like) are left out of "first". "none" rows (170) pass an exact predicate: a reorder is `none` only when the thing already is first or last in that sense, or sits directly above or below the other (contiguous lines); a number only when the setting already has that value; an option only when it is in the pick; a title only when it is the current title; an "add" request only when the exact described thing is present. Title rows are capped at 20% of the none rows (34), add-present rows are 24 to 51. All 170 were read.

Wording (the authored cores are the hand-written skeletons; each request is a core, optionally with an opener and a closer, around names from the program): authored cores per pool, remove 99 (+12 with dependents), above 52, below 50, first 36, last 36, rename 72, title 33, rename_field 70, add_option 77 (+34 for a named place), setting_value 55 (+12 up/down), range 34, quick 25, time 30, timer 8, target 10, wrap 39, split 40, add_field 41, add_stat 40, add_chart 40, add_list 40, add_section 40, add_reminder 40; 30 openers, 19 neutral and 7 reason closers. Masked-wording diversity (names, quoted text and numbers masked, gen/c2_audit.mjs):

| Kind | rows | distinct masked | top-5 share |
|---|---|---|---|
| add_chart | 520 | 520 | 1.0% |
| add_stat | 520 | 520 | 1.0% |
| add_list | 520 | 517 | 1.5% |
| add_field | 520 | 512 | 2.1% |
| add_reminder | 520 | 457 | 3.3% |
| remove_one | 450 | 437 | 2.7% |
| reorder | 450 | 446 | 2.0% |
| rename_button | 450 | 401 | 3.8% |
| rename_field | 450 | 415 | 3.8% |
| setting_value | 450 | 396 | 4.0% |
| sections | 450 | 445 | 2.2% |
| add_option | 450 | 359 | 5.3% |
| no_change | 170 | 167 | 4.7% |

Counting the bare core (before any opener or closer) the top-5 share is 3% to 10% (add_chart, add_stat, add_field and add_reminder sit near 10%, because they have 40 cores each). No test wording was read or copied; the added phrasings are general indirect, messy and role-based ways to say the same edit.

Not met or weak: long share is 26.6% overall, not 35%: the 396 long bases allow at most 4 edits each (1,584) and the cap is kept. The five new kinds are at 36% long except add_field (16%, only 71 long bases have an unreferenced, nameable field) and add_reminder (2.5%, long programs hold few reminders). add_option is 9% long, sections 20% long. no_change is 170 rows (2.9%), so it is under 400 by design. setting_value targets, timers and monthly reminders are few. Multi-edit requests (two changes in one sentence) are not produced; multi-clause means a reason or politeness clause around one edit.


### c2 revision 3 (critic round 2)

Regenerated only add_field, add_chart, add_list (new wording) and add_option, rename_field (position spread); every other row is kept as it was. The two ambiguous rows (c2-e-908ad5545f, c2-e-d3d4c6a94f) and the 15 `none` rows whose "add" wording belonged to the three rewritten kinds were dropped. v4.1.jsonl holds 5,815 c2 rows (revision 2 had 5,920). Gates on all 5,815: verify4 uncached 5,815 / 5,815, leak_check 0, at most 4 edits per base and 2 per kind. `out/newc2_ok.jsonl` has the 4,325 rows of every kind except add_field, add_chart, add_list (`out/newc2_ok_first.jsonl` is the 4,343-row file handed out first; it differs only in the old add_option and rename_field rows).

| Kind | Short | Long | Total |
|---|---|---|---|
| add_field | 375 | 75 | 450 |
| add_chart | 365 | 155 | 520 |
| add_list (lists, and sections holding anything) | 360 | 160 | 520 |
| add_option | 369 | 63 | 432 |
| rename_field | 312 | 138 | 450 |
| no_change | 97 | 56 | 153 |
| other kinds unchanged | | | remove_one 450, reorder 450, rename_button 450, setting_value 450, sections 450, add_stat 520, add_reminder 520 |

add_field now reads as a person would say it: the type is given by meaning ("a number of nights, at least one", "a yes or no for sent", "one of Catering, Decor or Other for the kind", "some text for the note, but it is optional"), ranges and units in spoken form, no type tokens, no colons. The line is still determined: the description is rebuilt from name, type, optional, range, default, label and unit, and the row is skipped if the rebuilt line differs. 450 of 520 fields could be described that way. add_chart and add_list have 63 and 64 authored cores (add_section, for a section holding a described thing, has 32 more) written around what the user wants to see (bars of how much was spent each day over the past week, the latest entries first, grouped by day); the section form has 10 different wrappers; filler tails that recurred across kinds were removed (closers are now a short neutral set plus a few per kind that fit it).

Position spread (target of the first operation, by table order in the program and by field order in its table):

| Kind | rows with a table | 1st table | 2nd | 3rd or later | 1st field | 2nd | 3rd | 4th or later |
|---|---|---|---|---|---|---|---|---|
| rename_field | 450 | 162 (36%) | 170 (38%) | 118 (26%) | 134 | 226 | 67 | 23 |
| add_option (pick in a table; 84 more rows are state or setting picks) | 348 | 153 (44%) | 161 (46%) | 34 (10%) | 52 | 134 | 132 | 30 |
| add_field | 450 | 174 (39%) | 202 (45%) | 74 (16%) | 101 | 213 | 102 | 34 |

Among programs with 3 or more tables: rename_field 118 of 213 rows on the 3rd or later table (55%), add_option 34 of 48 (71%), add_field 74 of 154 (48%). Before: first two tables held 87% of add_option and rename_field rows; now rename_field 74% and add_option 90% (only 48 add_option rows come from programs with 3+ tables that hold a pick in a later table, so the data cannot give more).

Masked-wording top-5 share: add_field 1.1%, add_chart 1.0%, add_list 1.2%, add_option 4.9%, rename_field 3.6%, no_change 5.2%. Long share: add_chart 30%, add_list 31%, add_field 17% (below 35%: the unchanged kinds keep their rows and the 4-edits-per-base cap leaves less room for long rows).
