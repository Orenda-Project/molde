# DATA_SPEC_r5.md: what to change in the training data for the next Gemma 270M round

Written 2026-11-26 from the failure hunt (`REPORT.md`); revised after the critic (leak check, skeleton cap, refusals in plain English, measured versus hypothesis). Evidence is in `results/gemma-r3.jsonl` and `results/gemma-r4ep2.jsonl` (raw), `labels/` (my hand labels), `cases.jsonl` (test set, sha256 in `cases.sha256`). Every example pair below is checked: programs pass `vendor/lang/check.mjs` (language 4698991) and are in formatter form; edit pairs also pass the data-safety diff (`evolve`) and a predicate that the edit does what the request says (`tools/check_targets.mjs`). Rebuild and re-check with `node spec/creates.mjs > spec/creates.jsonl` (same for `edits.mjs`, `long_edits.mjs`), then `node tools/validate_spec.mjs spec/<file>.jsonl`.

## 0. Rules for every new pair (the hygiene that the numbers below depend on)

1. **The test set stays out for good.** No request that is in `cases.jsonl` or within word-set Jaccard 0.75 of one (or an exact match for requests of 1 to 2 words); no program body that is a test base (the 7 long demo programs in `data/long/`). Dedupe new pairs against `cases.jsonl` with the same rule `tools/make_cases.mjs` used against v3.1.
2. **Gates, in this order:** checker passes; formatter form; for edits the data-safety verdict is not `refused`; the request's machine-checkable needs are present (named fields, numbers, units, named options, chart or total or streak words: the regexes in `tools/preds.mjs`); no string in the program that none of the request, the title or a field name explains (a leak scan: compare the words of every quoted label with the request and the other lines; flag and review).
3. **No templates.** Every program is written for its own request (hand-written or model-written one by one, then gated). Do not generate programs by filling slots.
4. **One level of richness per request.** A request of 1 to 3 words gets a small honest app (4 to 10 lines). A request that lists needs gets those needs and nothing else. See section 1, finding 1: adding unrequested settings, prices and budgets is what made r4 worse in the blind comparison.
5. **Two automatic build checks, both must pass for every file of new pairs** (exit code 1 on a hit): `node tools/leak_check.mjs <files>` (no request equal or near-duplicate, word-set Jaccard 0.75, 0.6 for requests of 5 words or fewer, to any test create request, chain seed request or chain step wording of `cases.jsonl`; no `before` program equal to a test base) and `node tools/skeleton_check.mjs <files>` (names, strings, numbers and the app line erased; no program shape may appear in more than 2 items; the cap for the full training set is in L4). The first spec version failed the first check on 62 of 81 items and the second on 3 shapes; this version passes both (`spec/` rebuilt: 71 examples checked, 69 programs in 56 shapes).
6. Keep the formatter's one-spelling rule and the `was` rule for renames. Settings edits carry `set`.

## 1. What the hunt found that changes the plan

1. **v3.1 did not make Gemma better at English creates.** Blind A/B of 30 English requests where both models passed the checker and wrote different programs: r3 won 19, r4 ep2 won 9, 2 ties. Hand labels on 147 paired requests: strict "did what was asked" r3 36%, r4 ep2 28% (English only, 63 requests: 52% vs 37%). r4 ep2 passes the checker more often (90.2% vs 87.7%) but adds unrelated settings and prices ("Budget per day" in a to-do app, "Price per ml" in a baby feeding log, "Coffee price per cup"). More of the rich, demo-style programs taught the small model to append things.
2. **Roman Urdu is a data hole, not a size problem.** v3.1 has 5 creates (of 14,644) with two or more Roman Urdu words. On 81 Roman Urdu and mixed requests r3 got 25% strict and 53% zero (unrelated app); r4 ep2 got 22% and 53%. The same requests in English (control run, REPORT section 7) are the measure of what data alone can recover.
3. **The model falls back on a few skeletons.** In r3's 357 builds, 5 program bodies were reused for 3 or more different requests, and the fallback shows in the wrong-topic builds; the ring counter, `zikr` or `practice` skeletons appear for requests about water, expenses, school attendance, weddings and a whatsapp reminder. v3.1 holds 421 ring counter programs, 348 `point team` scoreboards, 299 `mosque`/`beads` programs, and 1,291 rows made by the old template generators (`source` contains `template`: 977 creates, 314 edits). Half of all app creates in v3.1 repeat another program body (14,450 programs, 7,251 distinct bodies).
4. **Small edits are mostly not trained.** v3.1 edits by what they do and on programs of at most 12 lines: add field 202, add option 4, rename button 1, reorder 0, rename field with `was` 18, setting value 260, remove 252. r3 returned the program unchanged for 39% of definite edits, and r4 ep2 for 45%: add option (11 of 13) and rename button (20 of 34, r3) are the clearest.
5. **Long programs (40 to 89 lines) cannot be edited by r3 at all** (1 of 70 steps right) because it does not copy lines exactly. See REPORT section 4 for r4 ep2.

## 2. Remove or relabel in v3.1

| What | Rows | Why | Action |
|---|---:|---|---|
| Rows made by the v1 template generators (`source` contains `template`) | 1,291 (977 creates, 314 edits) | They are slot-filled skeletons: `quantity` 203, `mixedlog` 139, `ringcounter` 95, `countlog` 94, `scoreboard` 85, `habits` 78. They teach "when unsure, emit the skeleton". Kamal's rule is no templates. | Drop all, then re-add hand-written pairs for the same topics (section 3, classes C1 to C3) |
| Duplicate program bodies | 1,621 | Same body repeated more than 3 times with different requests and titles | Keep at most 3 per body (the 3 with the most different requests) |
| Ring counter (`draw width 240 tap add`), `point team` scoreboard, `mosque`/`beads` icon programs | 421 / 348 / 299 | Skeleton families that Gemma falls back on | After the template drop, cap each family at 120 rows; keep only rows whose request names the topic (counter, ring, tasbeeh, score, team, prayer) |
| Programs with leaked labels (`Quiz night` 24, `Ludo` 31 when the request is not Ludo, `Table_1` 19, `Add homework mark` 10, `A bank connection is not possible here` 10, `Played` 9, `Seated` 8, `Gross` 7, `Needs a visit` 5, `Add dua` 5, `Log study time` 3) | about 130 | The hunt saw each of these strings come back in unrelated apps | Drop, then run the leak scan of rule 2 over every create and drop what it flags |
| Long requests (18 or more words) answered by programs of 5 lines or fewer | 239 | Teaches that a detailed request gets a thin app (r3 `too thin` and `misses specifics`) | Relabel with a program that carries the needs, or drop |
| Colour, dark, title and size edits (`appline`) | 988 | The app does these itself when the wording matches; they are not what r5 needs from the model | Keep about 300 with unusual wordings ("i want a green theme", "turn on dark mode", "call this app X") only if APP_BUGS #5 is not fixed; otherwise drop 600 |

## 3. Create classes to add

Sizes assume one training round of about 24,000 pairs after section 2 (v3.1 minus about 4,000 rows). Additions below total about 6,400 creates and 3,700 edits. Section 5 says which lever (not just "more pairs") each class needs and what gain to expect.

### C1. Roman Urdu and mixed requests (class `roman_urdu`): add 1,500 creates

What is wrong: 25% strict, 53% unrelated app (r3 and r4 ep2). Examples of the miss: `waraish ka log` became a Quran pages tracker, `dudh ka hisaab` a Quran pages tracker, `dukaan ka hisaab` an app called "Dukan" with a people list, `bachon ki haziri` a music practice timer.

Shape: 700 short names (1 to 5 words: `paani peene ka hisaab`, `ghar ka budget`, `dawai ka reminder`), 500 sentences with specifics (`bachon ki fees ka record, kis ne di kis ne nahi, mahine ke hisaab se`), 300 English frame with Roman Urdu nouns (`dukaan ka daily sales with total`). About 60% reuse a good English program of the same topic (the request is the new part), 40% new programs. Titles and labels in English or in the Roman Urdu word the user used (`Paani`, `Khata`), never a different topic. Cover the 12 categories of the test set and the words: paani, kharcha/kharch/kharchay, hisaab/hisab, bachat, udhaar/udhar, dukaan, dawai, dudh, sabzi, haziri/hazri, bachon/bachay, ghar, shaadi, committee, waraish/exercise, neend, namaz, roza, quran, zakat, rickshaw, petrol, bijli, gas, ration, test/number. Spell variants (kharcha, kharch, kharchay) appear in separate pairs.

{{EX:roman_urdu:4}}

### C2. Calculators and formulas that mean what they say (class `calculator_semantics`): add 500 creates

What is wrong: 62 builds passed the checker and still computed nonsense (BMI that divides by the wrong thing, an age calculator with "old age" and "new age" settings, a unit converter with options `S25|U25|U50`, a coin flip with a price field, a plot that averages blood pressure by itself). Gemma writes plausible-looking formulas.

Shape: age, date difference, unit conversion (length, weight, money), percentage, discount, tax, tip, EMI, interest, BMI, split bills, zakat, fuel economy, GPA, time zones. Each program is gated by **execution**: load it with `vendor/lang/eval.mjs`, set the states and settings listed in the pair's test (inputs and the expected displayed number), read the formula result, and keep the pair only if it matches. Store the test in `meta.test`. This is the one gate in the whole spec that checks meaning, not form.

{{EX:calculator_semantics:4}}

### C3. Explicit specifics kept (class `keep_specifics`): add 1,500 creates

What is wrong: 55 builds were the right kind of app and dropped something the user named: pick-one moods became a 1 to 5 number, "glasses" became ml, five named habits were not there, "personal best and total volume" was missing, "change since last month" was nonsense. Numbers (a goal of 2500 ml, a target of 100) were kept most of the time; named fields, options, units and "per person" were not.

Shape: requests that list 2 to 6 specifics: named options, field names, units, a number, a chart type, a total, a streak, a per-person or per-category total. The program must pass the need check of rule 2 for every specific. 400 of the 1,500 are short (1 to 3 words) and must stay small (4 to 10 lines) with no invented extras.

{{EX:keep_specifics:4}}

### C4. Typed programs for the shapes that fail the checker (class `checker_shapes`): add 1,200 creates

What is wrong: 50 of 407 creates (12%) failed the checker: `E_TYPE` 34 (comparing text with a number, `slider` on a pick, a table where a column was needed, `count` without a condition), `E_UNKNOWN_NAME` 5, `E_DUP` 4, `E_TARGET` 4. Nine of them ran 12 or more resamples and ended in 25 to 57 lines of garbage (`zakat`, `dice`, `tictactoe`, `committee ka hisaab kitab`).

Shape: **on-policy repair pairs.** Run r3 and r4 ep2 on about 6,000 fresh prompts, keep the programs that fail, ask a stronger model to write the correct program for the same request (not to patch the broken one), gate it, add `request -> corrected program`. Shapes that must be covered: calculators with `state` and `field`, dice and random, board games and quizzes with state, committee and ledger programs with `ref` and per-person sums, timers with `every`, anything with `choice` and `slider`. Also 150 pairs where table names are chosen to avoid modifier words (`fill`, `color`, `stroke`, `width`, `height`, `radius`, `opacity`, `thick`) and reserved words (`then`, `as`, `it`).

{{EX:checker_shapes:3}}

### C5. Requests the app cannot do (class `unsupported_offline`): add 300 creates

What is wrong: 15 requests for things Molde cannot do (whatsapp, gps, camera, login, weather, chat, voice, internet scores, bank balance, 3D): none refused, 0 asked, 14 built an unrelated skeleton (a customer counter, a bike commute counter, a rain log, a workout log called "Flappy"). The app cannot ask (`allowAsk` is false when a request has a real word).

Shape: the closest honest offline app, with one line in the app that says what to do by hand. About 100 pairs per kind of limit (needs internet, needs a sensor, needs another person's phone). Pair this with the app-side capability list in section 5 so the user is told first.

{{EX:unsupported_offline:3}}

### C6. Labels that match the topic (class `label_leak`): add 300 creates

What is wrong: 13 builds carried strings from another app: "Log study time" in an attendance sheet, "Add homework mark" in a class average, "A bank connection is not possible here" in a budget, "Zakat and tip", "Quiz night", "Puppet" as a bug status. The strings are in v3.1 (section 2).

Shape: the same school, business, health and family topics as C3, with every label, button and title taken from the request's own words. Each example is the program a leaking model should have written for a request whose r3 or r4 answer carried a leak; the pair itself contains none of the leak strings, which is what the leak scan of rule 2 verifies on the training side. Pair with the drop in section 2.

{{EX:label_leak:3}}

### C7. Not thin, not padded (class `not_thin`): add 300 creates

Shape: medium requests ("pocket money tracker for my kids", "a simple khata for my customers", "savings") answered with 8 to 14 lines that cover what the request implies (per-child balance, per-customer balance, a goal and a quick-add), no more.

{{EX:not_thin:3}}

### C8. Realistic numbers (class `realistic_numbers`): add 300 creates

What is wrong: 6 builds with absurd defaults (a daily study goal of 12 hours, a weekly step goal of 1,000, a height of 18.5 cm, a baby feeding goal copied from the water app, a 2000 ml goal for "8 glasses"). Fix in data: ranges per unit (daily steps 5,000 to 12,000, weekly steps 35,000 to 84,000, study 1 to 5 hours, water 6 to 12 glasses or 1,500 to 3,500 ml, sleep 6 to 9 hours, calories 1,200 to 3,000, height 100 to 220 cm), and when the request gives a number or a unit the program uses it. Audit v3.1 for settings outside these ranges and fix or drop.

{{EX:realistic_numbers:3}}

### C9. Typos and one-word requests (class `typo_short`): add 300 creates

What is wrong: 4 of 23 typo requests built an unrelated app (`expence tracker` became a counter table called `seizure`, `medecine reminder` an antenatal visit planner, `sals report` a flour and cutting app); 6 of 65 one- to three-word requests failed the checker.

Shape: each correct request with 1 to 3 character-level typos (dropped, doubled, swapped letters, phone-keyboard slips), plus the same words in lower case with no spaces or with extra filler ("pls make a ... app"). Target is the program for the corrected request.

{{EX:typo_short:3}}

## 4. Edit classes to add

All edit pairs are written in the patch format of L1 (the examples below show the answer as patch operations; the whole program is derived by applying them). The program before is 4 to 25 lines unless the class says long; the change touches only what the request names; every other line is copied exactly. Add 30% identity-style negatives (see E10). The sizes sum to about 3,700.

### E1. Add a field (class `add_field`): add 500

What is wrong: r3 returned the program unchanged 26 of 68 times and did it right 16 times; r4 ep2 22 of 42 unchanged. When it did add a field it often chose the wrong one (`location` became `note text?`, `category` took the options of another app: `pick Vegetables|Dairy|Home|Other`). Cover: text, long, num with range and unit, money, date, time, bool, pick with 3 to 6 options named in the request, ref. Half of the pairs name the field type, half do not.

{{EX:add_field:3}}

### E2. Add an option to a choice (class `add_option`): add 400

What is wrong: forced suite (46 steps in v2, options that belong to the choice's family): see `controls/forced_v2_summary.txt`; in the first forced version 2 of 70 (r3) and 4 of 70 (r4 ep2) right, 56 and 59 unchanged; v3.1 has 4 such pairs on programs of 12 lines or fewer. Wording variants: "add X as an option", "add X to the choices", "also let me pick X", "I need X too in the list".

{{EX:add_option:3}}

### E3. Remove one thing (class `remove_one`): add 400

What is wrong: 0 of 23 final results (10 unchanged, 7 damaged other lines, 5 correct but blocked by the app guard, APP_BUGS #3). Cover chart, list, totals, goal, form, one field, one option, one button. Wording uses the user's noun ("the graph", "the totals", "the numbers at the top", "the history"), not the line keyword.

{{EX:remove_one:3}}

### E4. Add a chart or a stat (class `add_chart_stat`): add 400

What is wrong: add chart 23 of 41 right in r3, add stat 16 of 43; failures: unchanged (20), a stat added where a chart was asked ("i want to see a graph" gave `stat sum(...)`), checker failures on `trend` and `daybars` arguments (9). Cover each chart word of the language: daybars, bars, trend, heat, share, goalbars, daygrid, weekdots; and stat, statcard, goal.

{{EX:add_chart_stat:3}}

### E5. Sections (class `sections`): add 300

What is wrong: 4 of 29 right in r3. A correct section edit re-indents lines, so the app's 20% guard also blocks it (APP_BUGS #4): fix the guard and add these pairs.

{{EX:sections:3}}

### E6. A number changed in plain words (class `setting_value`): add 300 (only if APP_BUGS #5 is not fixed)

What is wrong: "i want to aim for 3000 instead", "make my goal 3000", "set the target to 100" went to the model and came back unchanged 15 of 27 times. Edits carry `set` on the setting line.

{{EX:setting_value:3}}

### E7. Rename a field, table or option with `was` (class `rename_field`): add 600

What is wrong: 3 of 28 right. The model writes the new name without `was` (the data rules refuse), or writes `was` and breaks the lines that used the old name. A correct pair renames every use (`sum(drink.amount today)`, `quick drink, amount, ...`). v3.1 has 39 such pairs in total. Cover field, table, pick option (`New was Old`), setting.

{{EX:rename_field:3}}

### E8. Rename a button or label (class `rename_button`): add 400

What is wrong: 6 of 34 right in r3 (20 unchanged); r4 ep2 is better on short programs (15 of 24) but the long-program cases are in E11. v3.1 has 1 such pair on a short program.

{{EX:rename_button:3}}

### E9. Reorder (class `reorder`): add 300

What is wrong: v3.1 has 0 reorder pairs on programs of 12 lines or fewer; 600 on long programs. The chain test had only 6 testable reorder steps, so the forced suite built 85 (a program with the form or chart in the wrong place, asked to put it back): r3 11 of 85 right, r4 ep2 26 of 85, the rest unchanged (73 and 43). This class needs base programs where the order is wrong on purpose.

{{EX:reorder:3}}

### E10. Vague requests and requests the app cannot do (classes `vague_ask`, `cannot_do_ask`): add 400

What is wrong: of 49 vague steps ("make it nicer", "make it simpler", "this is too busy"), 37 came back unchanged with no message, 6 tried a bigger change that the guards stopped, 3 failed the checker, 3 applied a small change; of 33 requests for email, sync, passwords and banks, the model left the program unchanged 20 times and tried to add an invented `remind` or `when` line 13 times (4 got through). Silent no-ops are not acceptable teaching data: the user must be told, in plain English, what the app can do instead. So no identity pairs. For a request the app cannot do, and for a vague request, the answer is the existing `ask` line (needs the capability and vague word list of L6, because `allowAsk` is false today for any request with a real word): one plain sentence that says what cannot be done and what can, and answer choices that are real edits. The `Edit request / Question / Answer` form then makes the change; the follow-up rows are in `spec/edits.jsonl` (one per choice that is a real edit, see below). The app keeps the program the whole time; a choice that declines ("Leave it as it is") needs no model call (an app-side rule: an answer that starts with "No" or "Leave" or "Nothing" closes the question), so there is no follow-up row for it. Never show the language's own syntax to the user (`was`, `pick ...`, `table`); the app's data-rule refusal text is a separate bug (APP_BUGS #11).

{{EX:cannot_do_ask:4}}

{{EX:vague_ask:7}}

### E11. Long programs (class `long_edit_copy`): add 600, in the patch format

What is wrong: r3 got 1 of 70 long steps right: it rewrote lines it was not asked to touch (`button if(adding, "Close", "Add student") ...` became `button "Close" ...`, `draw 100, 4` became `draw 100, 2`) and the guards then blocked the result. v3.1 has 2,983 long edits already; see REPORT section 4 for how r4 ep2 did with them, which decides whether more of the same helps.

{{EX:long_edit_copy:3}}

## 5. Levers: what to do for every failure class, with expected gain

"More pairs" is lever 0 and is already in sections 3 and 4. These seven levers change what the model is asked to do, so the same data goes further. Every claim below is marked **measured** (a number from this hunt) or **hypothesis** (something an experiment of section 6 must test). I give no percentage target that is not backed by a measurement: the earlier version's 55 to 62% and 55 to 65% were sums of hypotheses and are withdrawn.

### The levers

**L1. Edits as patch operations: the format of ALL r5 edit data.** The prompt shows the current program with numbered lines (`1| app "Water" ...`); the model writes only the change: `insert after N`, `replace N` or `replace N-M`, `delete N` or `delete N-M`, `move N-M after K`, each written line on its own line starting with `+ `. The app applies the operations deterministically (`exp/patch_ops.mjs` in the training repo, on Spark at `~/kamal/molde/train/exp/`; a reference copy is `tools/patch_ops_ref.mjs`), then checks the result like any program, so every line the user did not touch is copied by the app, not by the model. **Whole-program pairs are derived, not stored separately:** `applyOps(before, answer) = program` is asserted for every edit row in `spec/` (the builders fail if it does not round-trip), and the training rows are produced from the same source rows in either format. **Measured by the trainer (E1, 1 epoch on v3.1, 40 changes through the app):** lost lines fell from 422 to 38, checker pass rose from 28 to 33, changes that did what was asked went from 14 to 17; the last is not yet conclusive. **Measured here:** all 7,024 v3.1 edit pairs convert and round-trip (`tools/to_patch.py stats`, 100%), median 1 operation, patch about 16 tokens against 173 for the whole program. The model still writes every new line itself.

What an answer can be, and what the app does with it:
- **Operations:** applied to the program.
- **One `ask` line instead of operations:** the app shows the question with its choices and **keeps the current program exactly as it is** (`controller.dart` `_afterGenerate`: an ask result sets `pendingAsk` and returns before anything is applied). Nothing is replaced. The tap comes back to the model as `Edit request: <same request>` plus `Question: ...` and `Answer: ...` over the same program, and the model then writes the real edit (the follow-up rows below). `tools/validate_asks.mjs` checks all of this for every ask pair: one valid ask line, the program untouched by construction, follow-up rows with the same request and the same program, the question equal to the ask's, the answer one of its choices.
- **Nothing to do** (the request is already satisfied, for example "dark mode" on a dark app): an answer of `none`; the app treats it as no change and says "It already is that way". This needs one line in the applier (today an unknown op throws). Refusals and vague requests are never `none`: they are asks.

{{EX_PATCH}}

**L2. A plan line before the program.** `# need: field drink, field ml, goal, quick buttons, chart, list`. Written by the model from the request, **in English even when the request is Roman Urdu or has typos**. Vocabulary: `field NAME`, `setting NAME`, `option A/B/C`, concept words (goal, chart, total month, streak, list, form, reminder, timer, calendar, tick, quick buttons), and `cannot WHAT` for something the app cannot do (information only). The app removes the line before checking and showing the program. Training plans are derived from request plus target program (the plan lists what the request names and the program has) and verified with `tools/plan_check.mjs`. At inference, the plan is a checkable contract: every item must show in the program, and a program line that no plan item explains is a leak. Format change needed in the grammar: one optional `plan-stmt` as the first line. **Measured:** on the six example pairs the plan check passes the right program, and it flags the wrong outputs r3 and r4 ep2 gave for the same requests (r3 mood diary: missing `option happy/ok/sad/angry`, `field note`, `chart month`; r4 ep2 petrol: missing `field odometer`, `mileage`; r4 ep2 for `paani peene ka hisaab`: missing `field drink`, `list`); it passes the one case that was right (live scores by hand). Six cases are an illustration, not a rate: the rate needs the plans for the 407 requests (a day of work, `tools/plan_negative_check.mjs` is the harness).

{{EX:plan_line:7}}

**L3. Minimal pairs.** Same topic, different specifics, different programs, shown to the model together (same batch, same epoch): a water tracker in ml with a goal of 2500 and quick buttons for a glass and a bottle against the same app in glasses with a goal of 8 and a weekly chart; an expense tracker with named categories and a per-category chart against one that records who paid and has no categories. The model can only get both right by reading the request. For edits: the same program with two different requests that touch different lines. 1,000 pairs of creates (2,000 rows) and 1,000 edit pairs inside the C3 and E1 to E4 budgets.

{{EX:minimal_pairs:4}}

**L4. Diversity caps.** At most 15 creates per app title and topic (v3.1: 4,067 distinct titles; 213 titles have more than 15 rows and hold 2,305 rows above the cap: "pocket money" 72, "homework" 57, "plant care" 52, "water" 50, "gratitude" 50, "car service" 49, "calls to mom" 48). The freed budget (about 2,300 rows, plus the 1,291 template rows and 1,621 duplicate bodies of section 2) goes to new topics: the long tail of single-purpose tools (calculators, converters, scorers, school tools, shop tools, trade and farm records). Target: at least 1,500 titles that appear fewer than 5 times and zero titles above 15.

**L5. Roman Urdu, mixed and typo requests at real proportions.** 10 to 15% of creates (today under 0.1%). Of those: 50% Roman Urdu names and sentences, 25% English frame with Roman nouns, 25% typos in English. With the plan line (L2) these map to English plans.

**L6. "Can't do that yet" instead of a random app.** A capability word list in the app (internet, camera, gps, map, login, password, whatsapp, sms, email, audio, voice, ai, chatbot, weather, bank, 3d) lets the grammar offer the existing `ask` line for such a request. The model writes `ask "Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?" "Yes, a ride log" "No, never mind"`; the answer, in the existing `Request / Question / Answer` form, then builds the closest offline app. The current rule (`allowAsk` false when the request names a thing) stays for everything else. 300 pairs (150 refusals and 150 follow-ups).

{{EX:refusal_ask:4}}

**L7. Verifier-driven self-training and best-of-3.** For each new request, sample N = 4 programs from the current model (temperature 0.7, different seeds); keep those that pass **all** gates: checker, formatter, plan coverage (L2), needs present, leak scan, and for calculators the execution test; train on the best one (rejection-sampling fine-tune); where a sample passes and another fails, add the pair for a DPO step (good against bad, same request). This is also the way to produce C4 (repair pairs) at scale. At inference, creates run best-of-3 (the first greedy, two sampled, take the first that passes the gates): costs up to 3 times the time of a create (median 1.45 s on Spark CPU for r3, so about 4.4 s worst case, only for the requests that fail the gates). **Measured so far:** see `controls/summary.txt` (12 tries per line on the failed creates; three sampled creates per request; 126 unchanged edits replayed with sampling).

### Class by lever: what is measured and what is a hypothesis

| class (r3 hunt metric) | levers | measured | hypothesis to test |
|---|---|---|---|
| Checker failure (50 of 407 = 12.3%) | L7 best-of-3 and repair pairs (C4); error-aware retry; the table-name grammar fix (APP_BUGS #6) | with 12 tries per line 9 of the first 26 failed creates pass (35%); samples control in `controls/summary.txt` when finished | H1: repair pairs plus best-of-3 turn about a third of the failures into builds (about +4 builds per 100 requests), a half of those right |
| Meaningless formulas (62) | execution gate (C2), L7, L3 | nothing yet: no run has tried an executed-data round | H2: only calculators and formula apps (about 25 of the 62) can be executed; the structural nonsense is only reduced by the leak and plan gates |
| Misses a specific (55 partial) | L2, L3, C3 | plan check flags 4 of the 5 wrong outputs of r3 and r4 ep2 on five test requests (`tools/plan_negative_check.mjs`); five cases are an illustration, not a rate | H3: a plan line makes a third to a half of these checkable |
| Roman Urdu drift (81 requests, 25% strict, 53% zero) | L5, L2, C1 | **the same model on the English translation builds the right topic in 79 of 81 (97%)**; English-only strict is 42% (the r3 baseline on English requests, not a ceiling: nothing shows that r5 cannot exceed it) | H4: data brings Roman Urdu strict toward the English-only baseline, 40 to 45%; it may go beyond it |
| Wrong topic English (17), typo (4) | L4, L3, template drop, L5 | typo-corrected requests are right-topic 23 of 23, so typo drift is data | H5: English topic drift is partly capacity; unknown share |
| Unsupported built as supported (15 requests, 0 right) | L6 | 0 of 15 refused today; 1 of 15 sensible | H6: with the capability list and ask, most of the 15 become honest refusals plus the closest offline app |
| Leaks (13) and r4's unrelated settings | gates, drop of 131 leaking rows, template drop | the leak strings are in v3.1 (counts in section 2); r4 ep2 leaks more than r3 (9 against 4 on 147 paired requests) | H7: removing them stops the leaks; test on the same 147 |
| Collapse onto a memorised skeleton (quiz, mosque `Khatam`, ring counter; r3: 2 quiz, 6 mosque, 6 ring counter for requests that did not ask) | L4, L3, template drop | r4 ep2 has fewer (0 quiz, 4 mosque, 0 ring) but more leaks | H8: caps and minimal pairs reduce it |
| Absurd numbers (5), thin (4) | C7, C8, plan numbers | small classes | |
| **Create total** | all | measured baselines: r3 strict 36.9% overall, 42% on English-only requests; 9 of 26 checker failures recover with 12 tries per line | **H9 (hypothesis): data brings overall create strict to about 45%**, no run has tested it; L2 and L7 may take it higher. The gate in section 6 uses 45% as the first bar and any higher bar is set after the first experiment reports |
| Edits unchanged (39 to 45% of model steps; forced suite in the report) | L1 (patch format, ask, `none`), L3 for edits, E1 to E10, a sampled retry (APP_BUGS #10) | the unchanged output is shared across requests on one program and is a model behaviour, not a cache effect (fresh-core replay, `controls/identical_outputs_proof.txt`); the sampled-retry control is in `controls/summary.txt` when finished | H10: in a patch format "unchanged" has to be chosen; the right rate on short chains rises above its 32% |
| Edit checker failures (9 to 12%), long programs damaged (7 to 10%; 1 of 70 right) | L1 | all 7,024 v3.1 edits convert to patches and back exactly; median patch 16 tokens against 173 (tests the **format**, not whether the model can write patches); r4 ep2 shows more full-program long edits do not help (1 of 70 again) | H11: with patches the app copies every untouched line, so these failures cannot occur; the model's patch-writing skill is the open question |
| Applied wrong (8 to 10%), silent change of an untouched line (8 of 119 applied steps in r3, 2 of 134 in r4 ep2) | L3, E1 to E4, L1 with line anchors, a guard that compares meaning (APP_BUGS #12) | counted in the report | H12: patches with line numbers remove the silent rewrite class |
| Rename without `was` (3 of 28 right) | L1, E7, APP_BUGS #7 and #11 | counts | H13: the app-side `was` inference is the safer half |
| Guard false positives, 20% guard, hang, undo wording | app only (APP_BUGS) | counts in APP_BUGS | |
| **Edit total** | all | baseline 25% (82 of 321), of which 32% on short chains and 1 of 70 on long programs | **no target is claimed**: R5-A and R5-B of section 6 measure it |

## 6. Mix, order and the gate for the next round

- Start from v3.1 minus section 2 (about 17,700 rows). Add C1 to C9 (about 6,400 creates), E1 to E11 (about 3,700 edits, written in the patch format of L1 with the whole-program pair derived), and the L3, L5, L6 pairs inside those numbers. About 28,000 rows. The capacity limit is real, so if training time matters, drop the 988 appline edits and cap C3 at 1,000.
- Order inside an epoch: shuffle; do not put the new classes at the end.
- **Experiments, in this order, each against the same `cases.jsonl` and the forced edit suite (`controls/forced_cases.jsonl`):** the trainer's E1 (patch ops on v3.1, 1 epoch) has already run: lost lines 422 to 38, checker pass 28 to 33, good 14 to 17. Next: **R5-A** = the new data (sections 2 to 4) with edits in patch format (the r5 edit format), **R5-B** = R5-A with full-program edits (isolates the format on the new data), **R5-C** = R5-A plus L2 plan lines, **R5-D** = R5-C plus L7. If R5-A does not beat r3, the data is not the problem and the levers are the plan.
- **Gate before anything is called better than r3:** (1) the same `cases.jsonl` run through `tools/hunt.mjs`; (2) a blind A/B of r5 against r3 on the English creates where both pass (the 30-case protocol of `ab/`): r5 must win at least 20 of 30 with at most 2 ties; (3) strict "did what was asked" on the hand-labelled create sample at least **45%** overall (hypothesis H9; r3 is 36.9%) and at least 40% on Roman Urdu; (4) definite model-path edits: strictly more right than r3's 25.5% overall and 32% on short chains, no-op results below r3's 39%, and long programs above 1 of 70; the real target for edits is whatever R5-A shows; (5) median seconds per create not above 2.5 on Spark CPU with 4 threads (r3 1.45, r4 ep2 1.83). Higher bars are set only after R5-A and R5-B report.

## 7. A fast automatic intent judge (calibrated against the 407 hand labels)

Built: `tools/judge.py` (features, no model call, runs the 407 in under a second). Agreement with my labels, 5-fold cross-validated on r3: **strict 68.6% (kappa 0.39, AUC 0.76), lenient 82.6% (kappa 0.57)**; the checker-pass-only baseline is 49.1% (kappa 0.15) strict. Trained on r3, tested on the 147 r4 ep2 labels: strict 70.1%, lenient 76.9%. **Weakness, measured:** it prefers r4 ep2 to r3 (62.4% against 56.8% strict on the 407) while my hand labels and blind A/B say the opposite, and it agrees with my blind A/B picks 15 of 28 (chance). It misses the "looks complete but adds unrelated things" failure.

To make it a gate for training runs: (1) add plan coverage in both directions (every plan item in the program, every program setting or label explained by the plan), which targets exactly that failure; (2) put an LLM judge (haiku, with the rubric of REPORT section 8 and the request, program and plan) next to the features, fit a small logistic combination on the 407 + 147 labels, and report cross-validated agreement and the pairwise agreement with the 30 blind A/B picks; the bar to accept it for gating runs: strict agreement at least 80% and pairwise agreement at least 75%; (3) keep a hold-out of 100 new hand labels per round so the judge is re-calibrated and cannot be over-fitted by training against it.
