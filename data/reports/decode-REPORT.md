# Molde decode report: line-stepped decoding with a per-line name grammar

Written 2026-11-24. Code: branch `phase-2-decode` (worktree /tmp/molde-dec, folder `decode/`), language commit 5566396, llama.cpp b12144 `llama-server` (~/llama.cpp-b12144/llama-b12144), model r1 Gemma 3 270M (Q8_0 and Q4_K_M), laptop CPU, 6 threads, one slot. Data: the 44 held-out real-wording requests (40 corpus + 4 edits) and the 60 templated validation requests, the same files the trainer used (`train/data/out-r1`). Scorer: the trainer's `score.mjs` (copied to `decode/score.mjs`). Raw per-request outputs, scored rows and summaries: `decode/results/`.

## Arms

| arm | what it is |
|---|---|
| A | static `moldescript.gbnf`, whole program in one call, chat endpoint, greedy. The r1 report's setup. |
| A2 | as A, but the prompt is built with the real special-token ids (see finding 3). |
| B | line-stepped (one line per call, stop at newline, `cache_prompt`), static grammar for the line, checker after each line, up to 3 resamples (greedy first, then temperature 0.7 with new seeds), keep the greedy line if all fail. |
| C | line-stepped with the per-line name grammar, no resample. |
| D | C + checker resample. This is the method asked for. |
| E | extra arm, not asked for: D + end-type filters in the grammar (see below). |

Lines arms use the "tok" prompt (real ids for the turn markers, see finding 3). A single run of D with the text prompt gave 77.3% on real wording (Q8_0) against 70.5% with tok: the two are inside noise (44 requests, one request = 2.3 points).

## Table

"intent score" is the trainer's mean structural score, "intent auto" the share that passes its Phase 2a rule. "median lines" is the median program length next to the reference's median length (to show D is not winning with trivially short programs). Speed columns are confounded by load: another job kept the machine at load average 5 to 27 during these runs (last two columns), so compare speeds only between rows whose load is similar. A clean A vs D pair is the Q8_0 real-wording rows: A load 5 to 12, 2.46 s per app; C load 11 to 7, 2.58 s; D load 7.5 to 7.7, 2.73 s. A back-to-back A/D speed run on 14 requests was ruined by a load spike (A 2.2 s at load 7, then 7 s at load 19), so I do not report it.

| arm | quant | set | n | checker pass | intent score | intent auto | median lines (ref) | median s/app | median tok/s | calls/app (mean) | first-error classes | load avg start-end |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | Q8_0 | real 44 | 44 | 50.0% | 0.629 | 18.2% | 10 (11.5) | 2.46 | 57.3 | 1 | UNKNOWN_FIELD:7 TYPE:4 UNKNOWN_NAME:3 DUP:2 UNKNOWN_COMPONENT:2 CHILD:1 DEFAULT:1 UNKNOWN_TABLE:1 SYNTAX:1 | 4.98-12.56 |
| A2 | Q8_0 | real 44 | 44 | 45.5% | 0.626 | 18.2% | 11 (11.5) | 2.33 | 59.5 | 1 | UNKNOWN_NAME:7 TYPE:6 UNKNOWN_FIELD:5 UNKNOWN_COMPONENT:2 SYNTAX:1 DUP:1 CONTEXT:1 REF:1 | 12.19-13.04 |
| B | Q8_0 | real 44 | 44 | 56.8% | 0.615 | 20.5% | 11 (11.5) | 3.43 | 66.6 | 15.8 | UNKNOWN_FIELD:8 TYPE:5 UNKNOWN_NAME:3 SYNTAX:1 DUP:1 UNKNOWN_COMPONENT:1 | 13.04-11.37 |
| C | Q8_0 | real 44 | 44 | 70.5% | 0.615 | 20.5% | 10 (11.5) | 2.58 | 70.4 | 11.9 | TYPE:8 UNKNOWN_FIELD:3 DUP:1 UNKNOWN_NAME:1 | 11.37-7.49 |
| D | Q8_0 | real 44 | 44 | 70.5% | 0.631 | 22.7% | 11 (11.5) | 2.73 | 71.3 | 14.5 | TYPE:7 UNKNOWN_FIELD:2 UNKNOWN_NAME:2 DUP:1 SYNTAX:1 | 7.49-7.69 |
| E | Q8_0 | real 44 | 44 | 77.3% | 0.622 | 22.7% | 11 (11.5) | 3.18 | 59 | 13.6 | TYPE:3 UNKNOWN_FIELD:2 UNKNOWN_NAME:2 DUP:1 SYNTAX:1 HEADER:1 | 18.42-5.54 |
| A | Q4_K_M | real 44 | 44 | 43.2% | 0.651 | 11.4% | 10 (11.5) | 2.32 | 59.2 | 1 | TYPE:8 UNKNOWN_FIELD:7 UNKNOWN_NAME:4 UNKNOWN_TABLE:2 REF:1 CONTEXT:1 ARGS:1 SYNTAX:1 | 5.82-14.24 |
| A2 | Q4_K_M | real 44 | 44 | 45.5% | 0.637 | 13.6% | 10.5 (11.5) | 4.83 | 55.9 | 1 | UNKNOWN_NAME:10 UNKNOWN_FIELD:5 TYPE:4 DUP:2 UNKNOWN_COMPONENT:2 CONTEXT:1 | 13.5-17.64 |
| B | Q4_K_M | real 44 | 44 | 52.3% | 0.634 | 18.2% | 10 (11.5) | 12.13 | 50.1 | 15.1 | TYPE:6 UNKNOWN_NAME:4 UNKNOWN_FIELD:4 REF:2 WINDOW:1 DUP:1 UNKNOWN_TABLE:1 ACTION:1 UNKNOWN_COMPONENT:1 | 17.64-15.65 |
| C | Q4_K_M | real 44 | 44 | 56.8% | 0.662 | 20.5% | 10 (11.5) | 3.54 | 46.3 | 12 | TYPE:12 DUP:2 UNKNOWN_FIELD:2 CONTEXT:1 ACTION:1 UNKNOWN_NAME:1 | 15.65-14.19 |
| D | Q4_K_M | real 44 | 44 | 72.7% | 0.654 | 25.0% | 10.5 (11.5) | 5 | 41.4 | 13.8 | TYPE:7 DUP:1 CONTEXT:1 UNKNOWN_FIELD:1 ACTION:1 UNKNOWN_NAME:1 | 13.78-17.45 |
| E | Q4_K_M | real 44 | 44 | 75.0% | 0.662 | 25.0% | 10 (11.5) | 7.05 | 29.9 | 13.4 | TYPE:5 UNKNOWN_FIELD:2 DUP:1 CONTEXT:1 ACTION:1 UNKNOWN_NAME:1 | 19.02-20.22 |
| A | Q8_0 | templ 60 | 60 | 86.7% | 0.887 | 73.3% | 10 (10) | 2.2 | 66 | 1 | DUP:3 UNKNOWN_FIELD:2 REQUIRED:1 ICON:1 UNKNOWN_NAME:1 | 7.69-9.13 |
| A2 | Q8_0 | templ 60 | 60 | 88.3% | 0.873 | 78.3% | 10 (10) | 1.98 | 64.8 | 1 | DUP:2 REQUIRED:1 SYNTAX:1 UNKNOWN_TABLE:1 TYPE:1 UNKNOWN_NAME:1 | 9.13-8.33 |
| B | Q8_0 | templ 60 | 60 | 91.7% | 0.875 | 76.7% | 10 (10) | 2.41 | 68.2 | 13.1 | DUP:2 ICON:1 TYPE:1 UNKNOWN_NAME:1 | 8.33-10.09 |
| C | Q8_0 | templ 60 | 60 | 93.3% | 0.87 | 78.3% | 10 (10) | 2.5 | 72.1 | 12.6 | DUP:2 TYPE:1 UNKNOWN_NAME:1 | 10.09-12.38 |
| D | Q8_0 | templ 60 | 60 | 95.0% | 0.871 | 78.3% | 10 (10) | 2.33 | 73.9 | 12.8 | DUP:2 UNKNOWN_NAME:1 | 11.79-8.59 |
| E | Q8_0 | templ 60 | 60 | 95.0% | 0.871 | 80.0% | 10 (10) | 4.23 | 44.5 | 12.9 | DUP:2 UNKNOWN_NAME:1 | 5.54-21.05 |
| A | Q4_K_M | templ 60 | 60 | 83.3% | 0.874 | 75.0% | 10 (10) | 2.64 | 51.4 | 1 | TYPE:3 DUP:2 RANGE:1 SYNTAX:1 REQUIRED:1 ICON:1 UNKNOWN_FIELD:1 | 17.45-13.61 |
| A2 | Q4_K_M | templ 60 | 60 | 85.0% | 0.882 | 76.7% | 10 (10) | 2.92 | 48.1 | 1 | TYPE:3 RANGE:1 SYNTAX:1 ICON:1 DUP:1 INTERNAL:1 UNKNOWN_FIELD:1 | 13.61-18.52 |
| B | Q4_K_M | templ 60 | 60 | 86.7% | 0.887 | 76.7% | 10.5 (10) | 6.29 | 35.5 | 13.5 | TYPE:2 REQUIRED:1 ICON:1 DUP:1 UNKNOWN_NAME:1 INTERNAL:1 UNKNOWN_FIELD:1 | 17.43-27.06 |
| C | Q4_K_M | templ 60 | 60 | 90.0% | 0.874 | 76.7% | 10 (10) | 5.81 | 34.3 | 12.5 | DUP:2 RANGE:1 REQUIRED:1 TYPE:1 CONTEXT:1 | 26.17-20.34 |
| D | Q4_K_M | templ 60 | 60 | 91.7% | 0.875 | 78.3% | 10 (10) | 5.27 | 35 | 13 | DUP:2 REQUIRED:1 TYPE:1 CONTEXT:1 | 20.34-19.29 |
| E | Q4_K_M | templ 60 | 60 | 91.7% | 0.882 | 78.3% | 10 (10) | 5.68 | 38.3 | 13 | DUP:2 REQUIRED:1 TYPE:1 CONTEXT:1 | 20.22-20.9 |

Reproduction check: arm A gives 50.0% / 0.629 / 18.2% (Q8_0 real), 43.2% (Q4_K_M real), 86.7% / 0.887 / 73.3% (Q8_0 templated): identical to the r1 report to the digit, so the harness matches.

Sampling noise: with 44 requests the binomial standard error is about 7 points; 60 requests about 4.5 points. Differences below 10 points on a single set are not reliable. A to D on real wording (+20 points Q8_0, +29 points Q4_K_M) and A to E are well outside it.

### Headline (real wording, checker pass)

| | Q8_0 | Q4_K_M |
|---|---|---|
| A static grammar, one call | 50.0% | 43.2% |
| B lines, static grammar, resample | 56.8% | 52.3% |
| C lines, name grammar | 70.5% | 56.8% |
| D C + resample | 70.5% | 72.7% |
| E D + type filters | 77.3% | 75.0% |

Templated: A 86.7 / 83.3, D 95.0 / 91.7, E 95.0 / 91.7 (Q8_0 / Q4_K_M).

## What worked

1. **The name grammar is the lever.** B (same stepping and resample, static grammar) gains only +7 and +9 points over A; adding the name grammar (C) adds +14 points on Q8_0. Unknown field, unknown name, unknown table and unknown component fell from 13 of 22 failures (A, Q8_0) to 4 of 13 (C) and 4 of 13 (D). On Q4_K_M, which has more name slips, resample then matters (C 56.8% to D 72.7%).
2. **Cost is small.** About 12 to 14 llama calls per app instead of 1, but `cache_prompt` means each call processes only the new line: median prompt tokens processed per app 206 (D) vs 83 (A), generation tokens 142 vs 127. Building the grammar (Node, in the process that also runs the checker) is 50 to 130 ms per app in total (median, Q8_0 real: 59 ms for D). Wall time per app at similar load: 2.5 s (A) vs 2.7 s (D), about +10%. Tokens per second are unchanged (about 70 on an idle-ish machine).
3. **The grammar is not too tight.** Offline gold-coverage test (`decode/cover.mjs`, a small Earley recognizer for GBNF in `decode/gbnf.mjs`): for every line of each reference program, the per-line grammar built from the gold prefix must accept the gold line. Final grammar: 5,610 of 5,610 lines accepted on 504 programs (the 104 held-out plus 400 random training programs), with and without the type filters; 1,259 of 1,259 lines on the 104 held-out programs. Before one fix (`icon` followed by a formula) one line of 4,351 in the training sample was rejected. The static line grammar also accepts 1,259 of 1,259 (this validates the recognizer). No valid reference line is lost, so the gain is not bought with expressiveness the corpus uses.
4. **Programs are not shorter.** D median lines 11 (reference 11.5) vs A 10; zero one-line programs for D and E on Q8_0 and Q4_K_M real wording (A had 1 on Q8_0). Intent score is unchanged (0.629 A, 0.631 D, 0.622 E on Q8_0). Honest reading: more programs pass the checker, but the structural intent of the newly passing ones is about the same as the old failures (mean 0.56 for the 14 requests D fixes on Q8_0; 4 of them reach the intent_auto rule). The checker pass rate rose by +20 points; intent_auto by +4.5 points (18.2% to 22.7%). Valid is not the same as right (see examples e093, e005).
5. **Resample helps only where the first line is a near miss.** On Q8_0 D = C (70.5%), on Q4_K_M +16 points. D rejected 90 lines in 44 apps (Q8_0): E_TYPE 55, unknown name 12, unknown field 7, dup 4, context 3. Greedy repeats the same bad line; temperature 0.7 often does too (18 apps still fell back to the greedy line).
6. **Type filters (arm E, extra) help on real wording**: toggle target must be yes/no or a table, `remind at` must be a time or date column, `sum`/`avg` need a number column (all via the same typed-path builder, ~25 extra lines of builder code). E_TYPE first errors 7 to 3 (Q8_0). E: 77.3% / 75.0%, templated unchanged.

## What did not work or is still open

1. **E_TYPE is now the biggest class** (D Q8_0: 7 of 13 failures; Q4_K_M: 7 of 12). Binary operator type mismatches (`text - text`, `choice = date`, `date < yes/no`) and `add` value types (`seed.name = <row>`) are not covered by any filter I built; they need a type-aware expression grammar, which is a bigger job (the checker's own type rules would have to be turned into rules per operand type).
2. **Declaration positions stay open**, so duplicate field names (E_DUP, 1 to 2 per set) and `trend face, it.key` style slips remain. A "name already used in this table" exclusion is not expressible in one line grammar without knowing the table being written; a simple fix is resample with the error, which D already does.
3. **Resample cannot fix wrong intent.** Several fixed programs pass by avoiding the hard part (e093: a nonsense Ramadan program that passes; e005: charts dropped). Intent is flat.
4. **Repair-by-rewriting is not used**; the r1 report already showed it fixes nothing.
5. **Q4_K_M** only reaches the Q8_0 level with D/E (72.7% / 75.0% vs 70.5% / 77.3%); its first-pass quality is worse (C 56.8% vs 70.5%), and resample is what closes the gap (85 rejected lines per 44 apps, +16 points from C to D).
6. **Not run:** the text-prompt versions of B and C (only D text was run, Q8_0 real); a combined run on edits only (4 edit pairs are in the 44 and behave like the rest).
7. **Speed is not measured cleanly** (shared machine, see above). Q4_K_M rows ran at load 14 to 27 and are slower in wall time than Q8_0, most likely because of load, not quantisation (generation tokens per second are the same class in the r1 report).

### Findings that matter beyond this task

1. **The GGUF's turn markers are plain text for llama.cpp.** The server log says `<end_of_turn>` "was not control-type"; `/tokenize` splits `<start_of_turn>` into 7 text tokens (`<`, `start`, `_`, `of`, `_`, `turn`, `>`) with or without `parse_special`, so the chat template feeds the model a prompt that differs from training (HF used the real ids 105 and 106). I tested a prompt built with the real ids (arm A2): no gain (45.5% vs 50.0% on Q8_0 real, 88.3% vs 86.7% templated, inside noise). So it is not hurting the numbers, but the quant export should mark those tokens as control tokens before shipping; the phone app should use the same route in training and inference. The lines arms use the real ids.
2. The server adds BOS itself: a prompt that starts with `<bos>` ends up with two. Use the template output without BOS, or an id array that starts with 2.

## 8 examples (Q8_0, real wording; request, arm A output and first error, arm D output)

#### e005

Request: Track my livestock: for each goat give tag number, breed, birth date, weight in kg each month, vaccination dates, and deworming dates. Warn me 7 days before any vaccine is due and show a monthly weight chart per goat.

Arm A (fails: `line 8: E_UNKNOWN_FIELD: treat has no field "vaccinated". Fix: fields of treat: goat, at.`):

```
app "Livestock" paw mint
table goat tag text, kind pick Goat|Dog|Bird|Rabbit|Other = Goat, born date, weight num 0.., vaccinated bool
table treat goat ref goat
"Vaccines due this month" head
each treat month as r
  stack card gap 1
    r.goat.tag bold
    "Vaccine" r.vaccinated "days old" faint
    button "Vaccine given" tap add treat goat = r
"Good goat (kg per month)" head
bars options goat.kind, sum(it.weight), it.tag
form goat, "Add goat"
form treat, "Add vaccine"
```

Arm D (passes, intent 0.344):

```
app "Livestock" paw mint
table goat tag text, kind pick Goat|Dog|Bird|Rabbit|Other = Goat, born date, weight num 0.., vaccinated bool
table treat goat ref goat
"Vaccines due this month" head
each treat month as r
  if r.at < today
    stack card gap 1
      r.at bold
      "W" r.at "kg" faint
      if r.at < today
        "Due" small color bad
      else
        button "Done" tap set r.at = today + 7
"All goats" head
each goat sort tag as g
  row card gap 1 tap edit g
    stack grow
      g.tag bold
      "Vaccine" g.vaccinated faint
    g.weight
    toggle g.vaccinated
form goat, "Add goat"
form treat, "Add treatment"
```

#### e047

Request: tasbeeh counter for 3 zikr, with a reset button and total

Arm A (fails: `line 6: E_TYPE: cannot use = between text and a number. Fix: make both sides the same kind of value.`):

```
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 3 "Count to"
row gap 1
  each options zikr.phrase
    button it fill if(it = target, accent, soft) tap set target = it
button "Reset today" tap remove all zikr today
stat count(zikr), "all zikr"
```

Arm D (passes, intent 0.833):

```
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 3 "Count to"
state ph text = SubhanAllah
let n = count(zikr today where phrase = ph)
row gap 1
  each options zikr.phrase
    button it fill if(ph = it, accent, soft) tap set ph = it
draw width 240 tap add zikr phrase = ph
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
  label 50, 64, "Round" floor(n / target) + 1 faint
button "Reset today" tap remove all zikr today
```

#### e050

Request: meal planner for the week: breakfast, lunch, dinner, grocery list generated from it, and cost estimate

Arm A (fails: `line 23: E_UNKNOWN_FIELD: meal has no field "price". Fix: fields of meal: day, breakfast, lunch, dinner, grocery, at.`):

```
app "Meal plan" food mint
table meal day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, breakfast text, lunch text, dinner text, grocery text?
"Today" head
each meal where day = dayname(today) as m
  stack card gap 1
    row
      m.breakfast bold grow
      m.lunch faint
    "Dinner" faint
    each meal where day = dayname(today) as m
      row gap 1
        m.breakfast grow
        m.lunch faint
        m.grocery faint
form meal
"Week" head
each meal where day = dayname(today) as m
  row card gap 1
    m.day bold
    m.breakfast grow
    m.lunch faint
    m.grocery faint
"Cost" round(sum(meal.price month) + sum(meal.delivery month) + sum(meal.grocery month) * 10) / 10 bold
```

Arm D (passes, intent 0.524):

```
app "Meal plan" food mint
table meal day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, breakfast text, lunch text, dinner text, grocery text?, cost money?
"Today" head
each meal where day = dayname(today) as m
  stack card gap 1
    row
      m.breakfast bold grow
      m.lunch faint
    "Dinner" faint
    each meal where day = dayname(today) as m
      row gap 1
        m.lunch grow
        m.dinner
        m.grocery
"Grocery list" faint
each meal where day = dayname(today) sort cost as i
  row card gap 2 tap edit i swipe remove i
    i.day bold
    i.cost i.breakfast "to" i.lunch "to" i.dinner i.grocery faint
form meal
```

#### e054

Request: fridge grocery expiry alert, what items expire this week

Arm A (fails: `line 8: E_UNKNOWN_FIELD: food has no field "grams". Fix: fields of food: name, expires, at.`):

```
app "Fridge" milk mint
table food name text, expires date
let soon = count(food, it.expires < today)
soon "items expire soon" head color if(soon > 0, warn, good)
each food sort expires as f
  row card gap 1 tap edit f swipe remove f
    f.name bold grow
    f.expires f.grams "days" color if(f.expires < today, bad, muted)
    button "-1" tap set f.expires = today - 1
form food, "Add food"
```

Arm D (passes, intent 0.556):

```
app "Fridge" milk mint
table food name text, expires date
let soon = count(food, it.expires < today)
soon "items expire soon" head color if(soon > 0, warn, good)
each food sort expires as f
  row card gap 1 tap edit f swipe remove f
    f.name bold grow
    f.expires f.expires "days" color if(f.expires < today, bad, muted)
form food
```

#### e093

Request: Ramadan 30 days: taraweeh count, Quran pages read per day, charity given, and final summary when Eid comes

Arm A (fails: `line 7: E_UNKNOWN_COMPONENT: there is no component, statement or value called "pages". Fix: start the line with a statement from SPEC.md, a component (daybars, bars, trend, heat, share, list, log, for`):

```
app "Ramadan 30" moon plum
table nighteh
table read part text, surah num 1..30
"Taraweeh today" count(nighteh today) big
"Quran pages" head
each nighteh today as qn
  pages "Quran" n
"Charity given" head
each nighteh today as k
  if sum(k.read.pages) > 0
    "I gave this month" sum(k.read.pages month) faint
"Last 10 pages" head
each nighteh last 10 days as s
  row card
    s.key grow
    sum(s.read.pages) "of 30" bold
form nighteh, "Add to the summary"
```

Arm D (passes, intent 0.167):

```
app "Ramadan 30" moon mint
table nighteh
table read part pick Quran|Taraweeh|Isha|Witr
setting target num = 30 "Days for a 30-day Ramadan"
goal count(nighteh month), target, "Taraweeh counted this month"
count(nighteh week) "nights this week" big
"Quran pages" count(read last 30 days) faint
"Charity given" count(read today) "| Last monthday(" last(read.part) faint
remind "Charity is coming in a few days" at 8:00 if count(read today) = 0
form nighteh, "Add nighteh"
```

#### e135

Request: fasting days I do, want to see how many I did this year

Arm A (fails: `line 6: E_UNKNOWN_FIELD: inside "quick": fast has no field "n". Fix: fields of fast: .`):

```
app "Sunnah Fasts" moon mint
table fast
"This year" (count(fast year) * 100) / 100 "days" big
"This month" (count(fast month) * 100) / 100 "days" faint
heat last 30 days, count(fast on it), 1
quick fast, n, [2, 4, 6]
"Darker means" round(count(fast year where n = 1 or n = 2 or n = 3 or n = 4 or n = 5) * 10) / 10 "day" faint
```

Arm D (passes, intent 0.889):

```
app "Fasts" moon mint
table fast
"This year" (year(today)) big
"Days fasted" count(fast year) faint
button if(count(fast year) > 0, "Fasted today", "I fasted today") tap toggle fast
calendar fast
```

#### e024

Request: notes from my doctor visits, what he said, nxt visit date

Arm A (fails: `line 2: E_DUP: field "note" appears twice in visit. Fix: remove one or rename it.`):

```
app " Visits" heart plum
table visit note text, day date, note text
"Last visit" since(visit) big
"Next visit" since(visit) - since(visit) "days ago" faint
form visit, "Add a visit"
list visit by day
```

Arm D (fails: `line 8: E_TYPE: cannot use - between text and text. Fix: make both sides the same kind of value.`, intent 0.489):

```
app " Visits" heart ocean
table visit note text, body long
each visit where has(note, "visit") sort at desc as v
  row card tap edit v swipe remove v
    v.note bold grow
    v.body faint
form visit, "Add a visit"
"Next visit" first(visit.note where has(note, "visit")) - first(visit.note) "ago" faint
```

#### e029

Request: A row of five big emoji faces I tap once a day, and a line chart of the last 30 days

Arm A (fails: `line 3: E_CHILD: "table" cannot have indented lines under it. Fix: un-indent this line, or put both inside a stack/row/box.`):

```
app "FiveFaces" dumbbell ink
table face
  streak(face) "day streak" big
  button "Log face" tap add face
"Average this month" round(avg(face.day last 30 days)) faint
heat last 70 days, count(face on it), 5
```

Arm D (fails: `line 5: E_UNKNOWN_FIELD: inside "trend": face has no field "key" (here "it" is a face). Fix: fields of face: five, at. inside "trend", "it" means that component's own item (for example each day of a c`, intent 0.556):

```
app "FiveFaces" brain plum
table face five num 1..5
"Streak" streak(face) "days" big
"This month" count(face month) "of 5" faint
trend face, it.key
form face
list face
```


## What the phone app must implement

The method uses only stock llama.cpp: one grammar string per call, one sampling call per program line. No custom token mask, no logit hooks.

**Loop (per request)**

```
accepted = ""                                   # program text so far
for line_no in 1..70:
    g = buildLineGrammar(accepted)              # JS, about 5 ms per line (59 ms per app in total, median, Q8_0 real, D)
    for k in 0..3:                              # k = 0 greedy, k > 0: temperature 0.7, top_k 40, top_p 0.95, new seed
        out = llama.complete(prompt = chat_prompt(request) + accepted,
                             grammar = g, stop = ["\n"], n_predict = 200,
                             cache_prompt = true, temperature = (k == 0 ? 0 : 0.7), seed = f(k))
        if out.stop_type == "eos" and out.text == "": END (program complete)
        if out.truncated: continue                  # line too long: treat as rejected
        line = out.text + "\n"
        if no checker error on lines >= line_no in check(accepted + line): accept; break
    if nothing accepted: accept the greedy line and go on
    if the first line is an ask program: END
    accept
```

`chat_prompt` = `<bos> <start_of_turn> user \n SYSTEM \n\n Request: ... <end_of_turn> \n <start_of_turn> model \n` using the real token ids (2, 105, 106). The accepted text is appended as plain text. Prefix cache: llama.cpp reuses the common token prefix; only the new line is evaluated. (The accepted text is re-tokenised in full each call, so a token merge across a line boundary can differ from training; I saw no effect.)

**Grammar building** (`decode/linegram.mjs`, about 300 lines, plain JS; copies `lang/constrain.mjs` internals `envOf`, `scopeAt`, `fieldsOf`, `partsOf`, `step` from `decode/constrain_x.mjs`):

1. Read the static `moldescript.gbnf` once into a rule map.
2. From the checker on the prefix (`check(prefix)`): tables with fields and field types, lets, states, settings, screens, pick options, component definitions with parameter kinds (std components `bars`, `form`, `list` and user `def`s), drafts. For each allowed indent, the scope (`scopeAt(prefix, indent)`): values in scope (loop variables), the type of `it`, writable names. The next line may use indents 0 to the previous indent, plus one level deeper if the previous line opens a block (`def screen each if else stack row box scroll grid draw plot poly` or a component call). Indents with the same scope share one rule set (rules get a suffix per scope).
3. Replace the open `ident` in reference positions:
   - `path` = typed paths: heads are values in scope, tables, `it`, pick-option words, bare field names (for `where`/`sort`/`by`); after a dot only the parts of the head's type (fields, `at`, `id`, backlink tables, `key` for groups), to depth 4; unknown-type `it` falls back to any field.
   - `qpath` for `query` (heads whose type is rows/group), `optpath` for `each options t.f` (pick fields only).
   - `"ref" sp ident`, `"new" sp ident`, `"add" sp ident`, def param table kinds -> table names. `add T f = e` -> that table's fields only (one rule per table).
   - component call line: `call-stmt` -> one alternative per defined component with its own argument rules by parameter kind (table, src, name, win, act, icon, expr), required args mandatory, defaulted args optional.
   - `go` -> screens, `save` -> drafts, icons in `app`/`screen`/`icon` -> the icon list, `window ident` -> values, user formula calls -> lets, bare option words -> pick options, lead-of-line expressions -> `lpath` (replaces the 140-rule `lead-ident` table).
   - declarations stay open: new table, field, state, setting, let, def, screen, `each ... as x`.
   - optional type filters (arm E): `toggle` target, `remind at` target, `sum`/`avg` argument.
4. Root rule = one line (alternatives per indent) or the empty string (= end). Only rules reachable from root are emitted (12 to 25 KB of grammar text; the full static grammar is 23 KB).

If grammar building throws, fall back to the static line grammar for that line (counted: 0 times in all runs).

**Cost**: about 12 llama calls per app without resample (C: mean 11.9, one per program line plus the end check) and 14.5 with it (D: +2.6 calls for rejected lines; Q8_0 real, mean). Seconds per app on this laptop at load 7: 2.7 s for D vs 2.5 s for one-shot A; first call carries the prompt (~80 tokens), later calls about 15 to 30 tokens each. Memory: a grammar string of 10 to 25 KB per call; llama.cpp's own grammar compile is inside the call time and was not measured separately. The checker runs in JS in the app (the same `lang/check.mjs`); each call re-checks the prefix (a few ms).

**Honest limits for the phone**: pass rate is now limited by type errors, not names; the model's intent score did not move; ask the user for confirmation on the preview as before.

## Process notes

- I started two llama-server processes (mine on port 8201, one at a time) and at the end I mistakenly sent SIGTERM to two `llama-server` processes that belonged to the other training job (Qwen and Gemma, ports 52189 and 46295) while cleaning up with a loose `pgrep`; both stayed alive for several seconds and the Qwen job has since started a new server, so the damage looks small, but if that job lost an eval request it should be rerun.
- No model files were copied; results are text (4 MB). The worktree /tmp/molde-p2 was read only.
- Reproduce: `decode/serve.sh Q8_0` then `node decode/run.mjs --arm D --set real` (PROMPT=text|tok), `node decode/cover.mjs`.
