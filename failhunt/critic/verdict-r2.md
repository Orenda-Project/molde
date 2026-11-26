# Critic verdict, round 2 (commit 2a04de1, failhunt)

**VERDICT: FAIL.** Do not build r5 data from this spec yet. Biggest remaining flaw: the vague and cannot-do edit pairs replace the user's whole program with an `ask` line (spec/edits.jsonl `vg2`, "it feels crowded": 14 lines of app become one question), and the answer follow-up pairs that should restore the change are described in DATA_SPEC but not present in spec/. Training on that teaches the model to drop a working app on a vague request. Fix: keep the before program in every ask pair (the ask must be a question appended before, not a replacement), add the Question/Answer follow-up pairs as real rows, and add a check that an `ask` edit keeps every before line.

## 1. Identical-output proof: verified
- `results/proof-fresh.jsonl` has 39 records; 37 of 39 outputs are byte-identical to the original `results/gemma-r3.jsonl` output (I checked all 39). The two that differ are G04.L004.0 and G04.L004.2, as the proof says.
- All 39 prompts contain the request text; within each group the prompt md5s differ and the outputs match.
- Consequence: the model returns the same program for different requests with distinct prompts. Round 1's cache hypothesis is withdrawn; this is model behaviour. The "fresh restart" is only a `fresh: true` flag in the log, which I could not verify.

## 2. Leak and skeleton checks
- `node tools/leak_check.mjs spec/*.jsonl`: 71 examples, 0 leaks.
- `node tools/skeleton_check.mjs spec/*.jsonl`: 69 programs, 56 shapes, 0 over cap 2.
- My own token Jaccard check (threshold 0.6) of 71 spec requests against 1,213 test request texts (creates, seeds, steps): 0 hits. Highest is 0.56. Exact matches: 0 (round 1 had 33).
- Note: `spec/plans.jsonl` no longer exists. The 7 plan lines are inside `spec/creates.jsonl` (`create_plan`), and `validate_plans.mjs` passes them.

## 3. Spec examples
- Checker on all 71 `after` programs and all 44 `before` states: 0 failures. `mo diff` on all 33 edits: 0 refused.
- `tools/validate_spec.mjs`: 34 + 33 + 4 examples, 0 problems. `tools/check_targets.mjs` on the edits: 29 checked, 0 not detected.
- 15 random items (seed 11):
  - Good: rb3, ro2, le4, le1, ty1, rn3, ro3, af1, sv3 (correct `set` use), cs3, ks1, nt2, mp1b.
  - Problems: vg2 (deletes the app, see above). ck1 declares `state chosen` and never uses it (minor). id3 says "Your phone's own lock still protects them", an assurance the app cannot check.
- Refusals: 6 `ask` lines (rq1, rq2, id1, id3, vg1, vg2). All plain English and name what the app can do instead. The data-safety refusal text (APP_BUGS #11) is still DSL and is not in the spec.
- Template smell: none above cap. The mosque, water and to-do skeletons are gone from the spec.

## 4. Forced suite
- `results/forced-r3.jsonl` and `-r4ep2.jsonl`: 352 each. Per-kind numbers in REPORT.md match `tools/forced_stats.py` exactly (r3 23/352, 7%; r4 ep2 83/352, 24%; add option 2/70 and 4/70; remove 5/157 and 25/157; button 5/40 and 28/40; reorder 11/85 and 26/85).
- Applicability (15 random cases, seed 5): mechanically applicable, all start states contain the target. Weak points:
  - Option words come from a fixed menu regardless of domain. F-ao-c009 adds "Urgent" to a blood-sugar moment, F-ao-c114 adds "Gifts" to a zikr list. Scoring them as "right" tests the mechanics, not the sense.
  - F-bt-c129 "rename the +1 button": there are two `+1` buttons, so the target is ambiguous.
  - F-rs-c136 "take away the big numbers": the target stat is labelled "latest", so the referent is a guess.
- `forced_cases.jsonl` stores only the before program; the predicate lives in `make_forced.mjs`. The request was in the prompt in 704 of 704 forced runs.

## 5. REPORT.md and DATA_SPEC_r5.md: withdrawn estimates
- 55 to 62% and 55 to 65% are gone from both files (grep). REPORT section 4 states the withdrawal.
- Still a problem: DATA_SPEC section 5 calls "English-only strict 42% today" a **measured ceiling**. It is the r3 baseline, not a ceiling. The 45% gate is a hypothesis dressed as a measurement. Relabel it H9 with the gate.
- REPORT's claim of 232 of 414 model-path outputs shared with a different request: verified (I counted 232).
- Spec section 5 says "the follow-up pair that makes the change" exists (REPORT section 5). It is not in `spec/` (no Question/Answer rows).
