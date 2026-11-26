# Critic verdict, round 3 (commit b28f2d2, failhunt)

**VERDICT: FAIL** (narrow). The round-2 blocker is fixed. The biggest remaining flaw: no row trains the decline answers. The four "leave it / keep it / no" choices in the four ask pairs (id1, id3, vg1, vg2) have no follow-up row, so the path where the user says no and the app stays unchanged is never trained. `tools/validate_asks.mjs` prints "not covered" for each and still exits 0. Fix: add one follow-up row per decline choice with `answer` = no-op (or "# none") and make validate_asks exit 1 on uncovered choices.

## 1. Ask rows
- `tools/validate_asks.mjs spec/edits.jsonl`: 4 ask rows pass. Each has follow-ups with the same request prefix and the same `before`, and each answer is one of the listed choices.
- No ask destroys the app at app level. The validator enforces that the app keeps `before`. The rows still store the ask line as `program`, which reads as deletion, so the format depends on the app honouring that rule.
- Follow-up rows (id2, id4, vg3 to vg7) are coherent. Each answer produces the edit it names: "a weekly total" adds a week stat; "a bigger streak number" sets `big`; "a chart of the week" adds daybars; "a different colour" changes the colour; "bigger text" adds `large`; "the costs listed by kind" removes the list; "the rent line" removes the setting and its term from the total.
- Declines: uncovered (see above).
- Unflagged: rq3 ("track my truck on a map while i drive") is a create that silently builds an offline truck log with no Question/Answer. That is the substitution the ask design forbids, so it should be rewritten as an ask pair or dropped.

## 2. Patch answers
- All 38 edit rows (34 edits, 4 long) apply to `before` with `applyOps`, and the result equals `program` in all 38 (0 mismatches).
- Checker: 76 `after` programs and 42 `before` states, 0 failures.

## 3. Leak and skeleton
- `leak_check.mjs spec/*.jsonl`: 76 examples, 0 leaks. `skeleton_check.mjs`: 74 programs, 56 shapes, 0 over cap 2.

## 4. Wording
- "measured ceiling": 0 hits in REPORT.md and DATA_SPEC_r5.md. Pass.

## 5. Forced suite v2
- `controls/forced_cases.jsonl`: 296 (125 remove, 85 reorder, 46 add-option, 40 button). Results in `results/forced-r3.jsonl` and `results/forced-r4ep2.jsonl` (296 each). The counts in REPORT.md match: r3 26/296 (9%), unchanged 217; r4 ep2 78/296 (26%), unchanged 145.
- 12 random steps (seed 3): 11 fit their app. One does not: F2-rs-c232 "take away the total" removes a "Roza kept" count, not a total. The program has no total, so the referent is a guess and the step should be dropped.
- The results folder also has `forced2-r3.jsonl` and `forced2-r4ep2.jsonl`, 131 steps each, with no mention in REPORT.md (r3 14/131, r4 ep2 36/131). Document them or delete them.
- The request is in the prompt in all 296 runs.

## 6. Template smell (15 random rows, seed 21)
- No copy of the water or to-do skeleton beyond the cap. Edits are minimal and specific. Refusals are plain English.
- Mild: the form plus list plus daybars closing is repeated across rows. It is within cap but is the main shape to watch.
