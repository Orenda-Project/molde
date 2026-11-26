# Critic verdict: gemma-r3 failure hunt (2026-11-26)

Independent read of `failhunt/`. Nothing in the hunter's files was edited. Checker: `lang/mo.mjs` at commit 4698991 (extracted with `git archive` to a scratch dir). Caveat: I read REPORT.md's headline numbers before writing my rubric, so the rubric is blind to labels but not to the headline.

## Task 1: blind relabel (60 creates, seed 7)

Rubric written first (`rubric_blind.txt`). Labels from request + program only (`my_labels_part1.txt`, `my_labels_part2.txt`). Hunter labels opened only after that.

- Exact agreement: 53/60 = 88.3%. Agreement on did>=1 vs 0: 58/60 = 96.7%.
- Confusion (rows = mine, cols = hunter 0/1/2):
  - mine 0: 13 / 0 / 0
  - mine 1: 1 / 20 / 1
  - mine 2: 1 / 4 / 20
- Headline on this sample: hunter labels give 35.0% strict and 75.0% at least right kind; mine give 41.7% and 78.3%. Headline 36.9% / 70.8% is about right. With n=60 the error is about ±6 points, so I would not move the number.

Disagreements (who is right):
- c026 "books" (hunter 0, topic): hunter right. "Books for sale" stock sheet is a wrong reading of "books".
- c069 "budjet" (hunter 1, LEAK): hunter right. "A bank connection is not possible here" is unrequested text.
- c349 "show me the weather" (hunter 0): hunter right. It needs weather data the app does not have; it logs typed rain.
- c024 "wishlist" (hunter 1, GENERIC): hunter defensible. Unrequested due-date field.
- c110 "sugar ka record" (hunter 1, ROMAN): me right. Spoon log matches the request; hunter is stricter here.
- c074 "sleep tracker" (hunter 2): me right. Label "Average per week" sits on a per-night average.
- c215 "score keeper" (hunter 1, LEAK): unresolved. I cannot see the leaked text; hunter should name the line.

Net: the hunter's labels are slightly too lenient on wrong-topic and leak cases, and slightly too strict on two labels-vs-value cases. Calibration is good.

## Task 2: missed failure kinds (not in REPORT.md taxonomy)

1. **Identical edit outputs across different requests (biggest).** 264 of 488 model edit outputs (54%) are byte-identical to the output for a different request (same chain or another chain). Examples: L005.0-3 ("split it into sections", "improve it", "add a category", "rename the < button") all return the same 41-line program (md5 a5756153). h017.0, .2, .4, .5 ("rename the - button", "remove the big numbers", "add a stat for the total", "make it simpler") all return the same 5-line program. Other groups: e48f1fec covers "add a note field", "i want a pink theme", "make it simpler"; 5c33093d covers "add location", "make my goal 8000". 57 of the shared outputs are marked applied. The request is probably not reaching the decoder, or the output is cached by program. Either way the edit numbers (25.5% right, 39% unchanged) mix model error with pipeline error. Of my 40 sampled steps, 21 of 33 tested steps share output.
2. **120 of 608 chain steps never run.** Outcome is None with `na` reasons: "one of the two parts is missing" (33), "no choice field" (32), "already in that order" (13), "no stat/chart/goal to remove" (24), "nothing to undo yet" (8). Reorder is 6 tested of 52 steps, add-option 11 of 43. The report's "reorder 0/6" and "add option 0/13" are based on very few tests. Sample ids: h040.2, L014.1, L022.1, h021.0, h035.1, h107.2, h038.3.
3. **Refusal text written as DSL for the end user.** h107.1 ("Write 'details pick ... was aisle'") and h093.1 ("Write 'target text was note'") show internal syntax to a non-programmer.
4. **Silent no-op on vague or unsupported edits.** h021.4 and L025.1 ("make it simpler"), h012.1 ("make it work for 3 people at once"), h101.3 ("go back to how it was"). 37 of 49 vague requests end as noop_unchanged with no message. "Undo" ignores the history restore that mo.mjs already has (`diff --restore`).
5. **Guard says safe while behaviour changes.** h061.4 ("add a priority") silently removed `where done = no` from an each-loop; verdict safe. L023.2 ("rename note to info") appended `- 0.05 * 12 * 1000 / goal` to an unrelated chart axis; verdict safe. The 20% and unasked-removal guards check line counts, not meaning.
6. **Label contradicts value (create side).** c074 (per-night average labelled per week), c061 (third stat missing /100), c296 (first "profit" stat shows sales), c188 and c049 (two different labels, one formula). Only partly covered by "nonsense formulas".
7. **Button does not do what it says (create side).** c281 "Check" adds +1 with no comparison; c350 chatbot builds a broken quiz with a nonsense "each" line.
8. **Template collapse on unfamiliar requests.** Quiz skeleton (item, answer, right A|B|C) returned for chatbot (c350), gradebook (c287), Pakistan geography (c281), and quiz (c033). Mosque app "Khatam" returned for c114 (household chores) and c328 (udhaar). 19 creates share a program body with another request.
9. **Denominators do not reconcile.** Results contain 608 chain steps (report says 686) and 414 model-route steps (report says 321 model-path). 16 chains have no steps (seed_failed). Filter used for 321 is not stated.

## Task 3: spec check

- Checker run on all 81 spec programs (`after`) and all 44 `before` states: 0 failures. A known-bad result (c078) is correctly rejected, so the checker is live.
- `diff` verdict is "safe" on every edit pair checked, including the two no-op pairs below. The verdict does not test for teaching a no-op.
- Random 20 pairs (seed 7) judged:
  - About 14 target their stated class correctly (ao1, se1, cs3, ks2, ck1, rm3, ro3, ty1, sv1, sv3, cs4, pl1, rq2 contingent, ks4 ok).
  - id1 "email me a report every week" and id3 "add a password lock": the after is identical to before. These teach a silent no-op for an unsupported request, which is the failure kind in item 4 above. They should be a refusal line (the L6 design).
  - cs1 "age in days": hard-codes `born = 2000-01-01`. Teaches an arbitrary default, the "absurd default" class.
  - ll2 "label_leak": contains no leak, so it is a positive example that does not show the failure.
  - mp1a, ks1, pl1: the same Water skeleton (`table drink ml num 1..5000`, `goal sum(drink.ml today)`). 11 of 81 spec items use it. This is copy-paste grounding, not requested content.
  - rq2 asks a refusal question, but the app's no-ask rule (`allowAsk` false) blocks asks today. This only works after L6 ships.
- **Contamination:** 33 of 38 spec create requests are verbatim copies of requests in `cases.jsonl` (for example ks2 = c133, ks4 = c245, cs1 = c219, ru1 = c084). The spec says "never train on this set", so this must be fixed before any r5 training.
- **Gain estimates are not supported.** The create rows sum to +23 to +36 points, so 55 to 62% is inside the sum, but most rows say "estimate". The measured numbers are: English-only strict 42% (the data ceiling), Roman Urdu 40 to 45% at best, and 12 tries fixing 9 of 26 failed creates. Those support about 45% overall, not 55 to 62%. The edit target (25% to 55 to 65%) rests on round-trip conversion of 7,024 edits, which tests the patch format, not whether the model can write patches. The 25% baseline is itself affected by item 1 above.

## Ranked fixes

Single biggest flaw: the edit pipeline returns the same output for different requests (264 of 488 outputs), and the report does not mention it. Fix: dump the full prompt for L005 steps 0 and 1 and h017 steps 0 and 5; check that the request text is in the prompt tail and that no cache is keyed on the program alone. Rerun all 488 model edits with caching off and report the shared-output share, which must be 0%, before any edit number is quoted.

1. Count the 120 `na` steps in the denominators, or generate applicable requests so reorder (46 untested) and add-option (32 untested) get real samples.
2. Remove the 33 verbatim test requests from the spec. Add a build check that rejects any request whose text is in `cases.sha256`'s source list.
3. Rewrite id1, id3 and every other no-op edit pair as a one-line refusal or ask. Make the guard reject a "safe" verdict when a `where` filter or a formula on an untouched line changes (h061.4, L023.2).
4. Replace the user-facing refusal text (h107.1, h093.1) with plain English that names the field, not DSL syntax.
5. Replace the gain table with measured numbers or mark every row "unmeasured". Set the r5 gate at the current measured levels (45% create strict) and only then ask for 55 to 62%. Cap the Water skeleton at 3 items and drop the arbitrary `born` default in cs1.
