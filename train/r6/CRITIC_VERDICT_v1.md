# Round 6 critic verdict (sample60, judged by hand)

Method: read all 60 rows, then pulled the full `before` programs from `data/r6_train_rows.jsonl` to check neighbours, duplicates, leftovers and noop adjacency. Machine facts: all 55 edit rows apply cleanly, match `after`, pass check/format/load; no non-ASCII; no unchanged replace, reversed range or truncated expression found. The failures below are all semantic or wording, which the verifier cannot see.

## VERDICT: FAIL

49 of 60 good (82%), bar is 54 (90%). Two kinds are below 80%: add_chart (3/7) and cannot (3/5). The flaws are systematic (below), not random noise.

## Per-kind counts (good / total in sample)

| Kind | Good | Bad rows |
|---|---|---|
| add_chart | 3/7 | 1, 31, 51, 60 |
| add_section (weak kind) | 5/6 | 2 |
| add_stat | 6/6 | none |
| cannot / refusals (weak kind) | 3/5 | 24, 34 |
| delete | 5/6 | 45 |
| goalnum | 5/6 | 55 |
| move (weak kind) | 6/6 | none (7, 27 ambiguous, see notes) |
| noop (weak kind) | 5/6 | 38 |
| rename | 5/6 | 29 |
| rename_field (weak kind) | 6/6 | none (40 terse, see notes) |

Corpus balance matters too: add_section has 127 training rows, cannot 130, noop 140, versus 900-980 for add_chart, add_stat, move and delete. Three of the four "weak kinds" are the thinnest in the data.

## Worst 10 rows

1. Row 51 (add_chart goalbars). Request: "i would like a goal chart of ayahs against daily ayahs over the last 7 days, after the "sessions" section". Answer adds `goalbars last 7 days, sum(session.ayahs on it), daily_ayahs`. Line 12 of the same program already has `goalbars last 7 days, sum(session.ayahs on it where kind = New), daily_ayahs`. Near-identical duplicate chart.
2. Row 31 (add_chart goalbars). Request: "bar chart for price against target". Answer adds `goalbars last 7 days, sum(repair.price on it), target`. Line 35 already has `goalbars last 7 days, sum(repair.price on it where status = Collected), target`. Duplicate.
3. Row 60 (add_chart daybars). Request: "Add one column chart for sys values for the last 7 days". Answer is `daybars ... sum(reading.sys on it)`. Summing systolic blood pressure over a day is meaningless (two readings gives 260 mmHg). The chart kind and aggregate were picked mechanically.
4. Row 55 (goalnum). Request: "Change lowest good ph from 6.8 to 10." Result `ph_low = 10` while `ph_high = 7.8` and ph range is 4..10. The pH warning would fire always. Values are drawn without a sanity range, and a person would not type this.
5. Row 45 (delete). Request: "Can you take out the person form?" Answer `delete 7` removes `topbar person, "Add person"`. That is the only way to add a person, so the `person` table is orphaned, and the empty-state text on line 17 still says "Add your team with Add person." The request is ambiguous (no `form person` block exists) and the answer breaks the app.
6. Row 34 (cannot). Request: "Can you text me an sms when walkp is high?" A raw table identifier (`walkp`) is pasted into the sentence, and "text me an sms" is redundant. Not natural English.
7. Row 24 (cannot). Request: "Please send a whatsapp to my brother when i add something." Offered alternative: "a weekly total on this screen that you can read out". It has nothing to do with notifying someone. Canned alternatives are chosen by cannot-kind, not by the request (see systematic flaw 3).
8. Row 1 (add_chart trend). Request: "line graph of hours values across the past month". Answer `trend person last 30 days sort at, it.hours` plots the per-person capacity field in row-creation order, and line 38 already has `trend days last 30 days, sum(person.hours on it)`. Meaningless and redundant. "hours values" is also a template phrase.
9. Row 29 (rename). Request: rename "open jobs per item" to "start jobs per item". Subtitle stays "not delivered", so the new title is wrong for what the section shows. Random word swap; nobody would type this.
10. Row 38 (noop). Request: put "average a day, 7 days" in front of the section "Goal streak". The stat is a child of a 3-stat `row` (lines 14-17) that precedes the section. The user wants it taken out of that row; `none` is wrong or at best arguable. Also row 2 (add_section): "a part called ... that shows my all bought entries" is ungrammatical ("my all bought entries"), a template with a hole.

## Systematic flaws (builder must fix)

1. **add_chart picks do not check the program for an existing chart or a sensible aggregate.** 3 of 7 add_chart rows duplicate a chart already on screen or aggregate nonsense (sum of a reading, capacity over time). Rule needed: skip a (table, field, family) combination if an equivalent chart or stat already exists in `before`; only allow `sum` on additive fields (money, counts, minutes), use `avg` or `max` for readings (sys, dia, ph, temp, weight), and never `trend` over a non-event table such as a person or capacity table.
2. **Request text leaks raw schema names.** "walkp is high", "dones", "givens", "cones of restocks", "my all bought entries", "a "All dones"" (row 52). Add a humanising step (singular/plural words from the label or a small noun map) and drop any row whose request still contains a table identifier that is not an English word. A grammar filter on "my all", "a All", "of <table>s of" would catch most.
3. **Cannot alternatives are canned per kind, not per request.** There are 12 fixed "Do you want ..." sentences for 130 rows. They sometimes mismatch (whatsapp-to-brother gets "weekly total you can read out"). Map each refusal topic to a matching alternative (message or sms: reminder or on-screen message; email or print: month summary; internet: hand-typed setting) and avoid raw identifiers in the request.
4. **Numeric edits have no sanity range.** goalnum picks values without checking them against sibling settings or the field range (row 55: lower bound above the upper bound). Pair settings (low/high, min/max) must keep order; keep new values within 0.25x to 4x of the old value unless the request names it.
5. **Delete of an anchor the app depends on.** Deleting a `topbar T` leaves table T unreachable, and stale text mentions it. Either exclude topbar from `delete`, or only allow it when another `form T` exists. Reword requests so "form" refers to a real `form` block.
6. **Noop rows must not use row children.** Count a noop as "already in place" only when the target is a top-level block or line directly before the anchor, not a child inside a `row`, `stack` or `each`. Also keep an eye on the request style: all 140 noop answers are `none`, and 100% of noop requests say "in front of / on top of". A model can learn "move X in front of Y means none". Make sure real moves with the same phrasing (not adjacent) are also in the move kind in equal numbers (they are, from this sample, but verify the ratio per phrasing).
7. **Rename (plain) picks arbitrary synonyms.** "open jobs per item" to "start jobs per item", "Streak" to "Run" for a knitting-days streak. Use a curated list of sensible pairs (Totals/Sums, Last 14 days/Past two weeks, Last 30 days/Past month) and skip pairs that contradict the subtitle.
8. **Thin weak kinds.** add_section 127, cannot 130, noop 140 versus ~950 for the strong kinds. Raise add_section (list and form, with before and after anchors, plus a new-table variant) and cannot to at least 400 each, or down-weight strong kinds in the mix.

## Notes that did not make a row bad (keep an eye on them)

- Row 27 ("before the form for adding repair entries") and row 18 ("the reading form") treat `topbar` as "the form". `topbar` is the app bar and its form opens on tap (SPEC line 409), so "before the form" has no visible meaning; the result (section first) is reasonable but the wording is odd. Row 7 puts the moved section before the `topbar` line (source order), which renders the same as after it. Pick one convention for "top of the screen" (after the last declaration or after `topbar`) and use it everywhere.
- Row 40 "call mins time" is terse but unambiguous in that app; consider adding "field" or "rename" in some rows. The label strings ("highest mins today", "highest price in the last 30 days") are left in old wording after a field rename; fine, but a few "rename and update the labels" rows would be good variety.
- Repeated openings in the whole file: "reorder the screen: the ..." (100), "can you add the/a" (144), "i would like the/to" (129), "change only the words" (67), "i do not need" (55). Visible in the sample too. Lower the weight of these templates.
- Verified clean: all renames in rows 10, 20, 30, 40, 50, 59 update every use of the old field (no leftovers except label strings); delete ranges 5, 15, 25, 35, 54 cover whole blocks with no orphan; moves land on block boundaries; row 17 correctly lands after the 3-stat row, not inside it.

## Re-check

Re-run the critic on a fresh sample with a seed the builder has not seen (`node sample_for_critic.mjs 60 <new seed>`) after fixes 1 to 6. Pass needs 54 of 60 good and no kind below 80%.
