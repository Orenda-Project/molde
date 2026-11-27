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

Hand-written by one program at a time into hand/a2-c-*.txt, built by gen/build_creates.mjs (now also reads a2-c-*; env ONLY=prefix probes a prefix without writing hand_creates.jsonl), skeleton cap checked by gen/a2_skel.mjs (cap 2: 0 over). Verified uncached (686 of 686 in new41, of which 225 are a2 rows), leak 0. The delta is out/newa2.jsonl.

| Class | Rows |
|---|---|
| keep_specifics | 76 |
| rich_app | 4 |
| roman_urdu | 120 |
| sensible_calc | 10 |
| typo_en | 6 |
| typo_short | 9 |

Direction change mid-run (Kamal): Roman Urdu stopped at 129 surviving rows (target 1,000 not met; 45 of 270 written rows were dropped by the leak, duplicate and title-cap steps). Priority became English creates with many specifics, sensible calculators, English typo requests, richer apps.

Not met: English specifics 76 of 1,200; sensible_calc 10 of 600; typo_en 6 of 200; rich_app 4 of 300. Do not run gen/snap41.py: it cuts STATS.md at the v4.1 snapshot heading and would delete the b2 and a2 sections.
