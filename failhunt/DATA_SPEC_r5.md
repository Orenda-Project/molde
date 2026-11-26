# DATA_SPEC_r5.md: what to change in the training data for the next Gemma 270M round

Written 2026-11-26 from the failure hunt (`REPORT.md`). Evidence is in `results/gemma-r3.jsonl` and `results/gemma-r4ep2.jsonl` (raw), `labels/` (my hand labels), `cases.jsonl` (test set, sha256 in `cases.sha256`). Every example pair below is checked: programs pass `vendor/lang/check.mjs` (language 4698991) and are in formatter form; edit pairs also pass the data-safety diff (`evolve`) and a predicate that the edit does what the request says (`tools/check_targets.mjs`). Rebuild and re-check with `node spec/creates.mjs > spec/creates.jsonl` (same for `edits.mjs`, `long_edits.mjs`), then `node tools/validate_spec.mjs spec/<file>.jsonl`.

## 0. Rules for every new pair (the hygiene that the numbers below depend on)

1. **The test set stays out for good.** No request that is in `cases.jsonl` or within word-set Jaccard 0.75 of one (or an exact match for requests of 1 to 2 words); no program body that is a test base (the 7 long demo programs in `data/long/`). Dedupe new pairs against `cases.jsonl` with the same rule `tools/make_cases.mjs` used against v3.1.
2. **Gates, in this order:** checker passes; formatter form; for edits the data-safety verdict is not `refused`; the request's machine-checkable needs are present (named fields, numbers, units, named options, chart or total or streak words: the regexes in `tools/preds.mjs`); no string in the program that none of the request, the title or a field name explains (a leak scan: compare the words of every quoted label with the request and the other lines; flag and review).
3. **No templates.** Every program is written for its own request (hand-written or model-written one by one, then gated). Do not generate programs by filling slots.
4. **One level of richness per request.** A request of 1 to 3 words gets a small honest app (4 to 10 lines). A request that lists needs gets those needs and nothing else. See section 1, finding 1: adding unrequested settings, prices and budgets is what made r4 worse in the blind comparison.
5. Keep the formatter's one-spelling rule and the `was` rule for renames. Settings edits carry `set`.

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

**Example 1** (ru1)

Request: `paani peene ka hisaab`

```
app "Paani" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500, 750]
daybars last 7 days, sum(drink.ml on it)
list drink
```

**Example 2** (ru2)

Request: `bachon ki haziri lagane ka app`

```
app "Haziri" users plum
table student name text
table absent student ref student
state d date = today
row align center
  button "<" tap set d = d - 1
  dayname(d) monthday(d) monthname(d) head grow align center
  button ">" tap set d = d + 1
count(student) - count(absent on d) "of" count(student) "present" big
grid 3 gap 1
  each student sort name as s
    stack radius 8 pad 1 fill if(count(s.absent on d) > 0, bad, good) tap toggle s.absent on d
      s.name bold align center color bg
      if(count(s.absent on d) > 0, "Absent", "Present") tiny align center color bg
form student, "Add student"
```

**Example 3** (ru3)

Request: `dukaan ka udhaar ka hisaab`

```
app "Udhaar" wallet slate
table person name text, phone text?
table entry person ref person, amount money, kind pick Gave|Got, note text?
"People owe you" sum(entry.amount where kind = Gave) - sum(entry.amount where kind = Got) big
each person as p
  let bal = sum(p.entry.amount where kind = Gave) - sum(p.entry.amount where kind = Got)
  stack card tap edit p
    row
      p.name bold grow
      if(bal >= 0, "owes you", "you owe") abs(bal) color if(bal >= 0, good, bad)
form person, "Add person"
form entry, "Add entry"
list entry by day
```

**Example 4** (ru4)

Request: `dawai lene ka time yaad dilao`

```
app "Dawai" pill plum
table med name text, dose text?, time time
table taken med ref med
remind "Dawai ka waqt" at med.time
count(taken today) "of" count(med) "taken today" head
each med sort time as m
  row card gap 2 tap edit m swipe remove m
    stack grow
      m.name bold
      m.time m.dose faint
    toggle m.taken
form med, "Add medicine"
```


### C2. Calculators and formulas that mean what they say (class `calculator_semantics`): add 500 creates

What is wrong: 62 builds passed the checker and still computed nonsense (BMI that divides by the wrong thing, an age calculator with "old age" and "new age" settings, a unit converter with options `S25|U25|U50`, a coin flip with a price field, a plot that averages blood pressure by itself). Gemma writes plausible-looking formulas.

Shape: age, date difference, unit conversion (length, weight, money), percentage, discount, tax, tip, EMI, interest, BMI, split bills, zakat, fuel economy, GPA, time zones. Each program is gated by **execution**: load it with `vendor/lang/eval.mjs`, set the states and settings listed in the pair's test (inputs and the expected displayed number), read the formula result, and keep the pair only if it matches. Store the test in `meta.test`. This is the one gate in the whole spec that checks meaning, not form.

**Example 1** (cs1)

Request: `age in days calculator`

```
app "Age in days" calc ocean
setting born date = 2000-01-01 "Date of birth"
let days = today - born
"Days old" days big
"About" floor(days / 365) "years" faint
```

**Example 2** (cs2)

Request: `unit converter for kilometres and miles`

```
app "Km and miles" calc slate
state km num = 0
state mi num = 0
field km "Kilometres"
field mi "Miles"
"Kilometres in miles" round(km * 0.621371 * 100) / 100 big
"Miles in kilometres" round(mi * 1.609344 * 100) / 100 big
```

**Example 3** (cs3)

Request: `discount calculator`

```
app "Discount" calc ocean
state price money = 0
state off num = 20
field price "Price tag"
field off "Discount %"
let saved = price * off / 100
"You pay" round(price - saved) big
"You save" round(saved) faint
```

**Example 4** (cs4)

Request: `simple calculator`

```
app "Calculator" calc mint
state a num = 0
state b num = 0
state op pick Add|Subtract|Multiply|Divide = Add
field a "First number"
choice op
field b "Second number"
let r = if(op = Add, a + b, if(op = Subtract, a - b, if(op = Multiply, a * b, a / b)))
"Result" round(r * 100) / 100 big
```


### C3. Explicit specifics kept (class `keep_specifics`): add 1,500 creates

What is wrong: 55 builds were the right kind of app and dropped something the user named: pick-one moods became a 1 to 5 number, "glasses" became ml, five named habits were not there, "personal best and total volume" was missing, "change since last month" was nonsense. Numbers (a goal of 2500 ml, a target of 100) were kept most of the time; named fields, options, units and "per person" were not.

Shape: requests that list 2 to 6 specifics: named options, field names, units, a number, a chart type, a total, a streak, a per-person or per-category total. The program must pass the need check of rule 2 for every specific. 400 of the 1,500 are short (1 to 3 words) and must stay small (4 to 10 lines) with no invented extras.

**Example 1** (ks1)

Request: `track how many glasses of water i drink each day`

```
app "Glasses" drop ocean
table drink glasses num 1..20 unit "glasses"
setting goal num = 8 "Daily goal (glasses)"
goal sum(drink.glasses today), goal, "today", "glasses"
quick drink, glasses, [1, 2]
daybars last 7 days, sum(drink.glasses on it)
list drink
```

**Example 2** (ks2)

Request: `a mood diary where i pick how i feel`

```
app "Mood" smile ink
table entry mood pick Happy|Ok|Sad|Angry = Ok, note text?
share entry month by mood, count(it), it.key
form entry, "Add mood"
list entry by day
```

**Example 3** (ks3)

Request: `daily petrol log with litres, price per litre, odometer and a calculated mileage per litre and monthly cost`

```
app "Petrol" car slate
table refuel litres num 1..200, price money, odo num 0..2000000 "Odometer"
let km = max(refuel.odo) - min(refuel.odo)
"Cost this month" sum(refuel month, it.litres * it.price) big
"Mileage" round(km / max(sum(refuel.litres), 1) * 10) / 10 "km per litre" faint
form refuel, "Add refuel"
list refuel by day
```

**Example 4** (ks4)

Request: `habit tracker for five habits: prayer, reading, exercise, water and sleep before 11, with a streak and a weekly view`

```
app "Five habits" check mint
table tick what pick Prayer|Reading|Exercise|Water|Sleep_before_11
each options tick.what as h
  row card gap 2
    h bold grow
    streak(tick where what = h) "day streak" faint
    count(tick week where what = h) "this week" faint
    button "Done today" tap add tick what = h
heat last 70 days, count(tick on it), 5
```


### C4. Typed programs for the shapes that fail the checker (class `checker_shapes`): add 1,200 creates

What is wrong: 50 of 407 creates (12%) failed the checker: `E_TYPE` 34 (comparing text with a number, `slider` on a pick, a table where a column was needed, `count` without a condition), `E_UNKNOWN_NAME` 5, `E_DUP` 4, `E_TARGET` 4. Nine of them ran 12 or more resamples and ended in 25 to 57 lines of garbage (`zakat`, `dice`, `tictactoe`, `committee ka hisaab kitab`).

Shape: **on-policy repair pairs.** Run r3 and r4 ep2 on about 6,000 fresh prompts, keep the programs that fail, ask a stronger model to write the correct program for the same request (not to patch the broken one), gate it, add `request -> corrected program`. Shapes that must be covered: calculators with `state` and `field`, dice and random, board games and quizzes with state, committee and ledger programs with `ref` and per-person sums, timers with `every`, anything with `choice` and `slider`. Also 150 pairs where table names are chosen to avoid modifier words (`fill`, `color`, `stroke`, `width`, `height`, `radius`, `opacity`, `thick`) and reserved words (`then`, `as`, `it`).

**Example 1** (ck1)

Request: `a dice roller`

```
app "Dice" dice plum
state roll num = 1
draw 100, 100 width 160 tap set roll = random(6)
  rect 4, 4, 92, 92 radius 16 fill soft stroke ink thick 2
  label 50, 54, roll big
button "Roll again" tap set roll = random(6)
```

**Example 2** (ck2)

Request: `committee or bc tracker with 12 members, monthly amount 5000, tick who has paid this month and total collected`

```
app "Committee" users plum
table member name text
table paid member ref member, amount money
setting amount money = 5000 "Monthly amount"
"Collected this month" sum(paid.amount month) big
each member sort name as m
  row card gap 2
    m.name bold grow
    if(count(m.paid month) > 0, "Paid", "Not paid") color if(count(m.paid month) > 0, good, bad)
    button "Got it" tap add paid member = m, amount = amount
form member, "Add member"
```

**Example 3** (ck3)

Request: `a tip calculator for dining out`

```
app "Tip" calc mint
state bill num = 0
state pct num = 15
state people num = 2
field bill "Bill"
slider pct 0..30
field people "People"
let tip = bill * pct / 100
"Tip" round(tip) big
"Each pays" round((bill + tip) / max(people, 1)) bold
```


### C5. Requests the app cannot do (class `unsupported_offline`): add 300 creates

What is wrong: 15 requests for things Molde cannot do (whatsapp, gps, camera, login, weather, chat, voice, internet scores, bank balance, 3D): none refused, 0 asked, 14 built an unrelated skeleton (a customer counter, a bike commute counter, a rain log, a workout log called "Flappy"). The app cannot ask (`allowAsk` is false when a request has a real word).

Shape: the closest honest offline app, with one line in the app that says what to do by hand. About 100 pairs per kind of limit (needs internet, needs a sensor, needs another person's phone). Pair this with the app-side capability list in section 5 so the user is told first.

**Example 1** (un1)

Request: `live cricket scores from the internet`

```
app "Score sheet" ball ocean
table score runs num 0..999, wickets num 0..10, overs num 0..50
last(score.runs) "/" last(score.wickets) big
"Type the score by hand: Molde apps work without the internet." faint
form score, "Update score"
list score by day
```

**Example 2** (un2)

Request: `scan receipts with the camera and read the amounts`

```
app "Receipts" list slate
table receipt amount money, shop text?, photo image?
"This month" sum(receipt.amount month) big
"Add the picture and type the amount." faint
form receipt, "Add receipt"
list receipt by day
```

**Example 3** (un3)

Request: `gps tracker for my bike rides on a map`

```
app "Bike rides" bike ocean
table ride km num 0.1..300, mins num 1..900, route text?
stat sum(ride.km week), "km this week"
"Molde cannot read GPS: type the distance after each ride." faint
form ride, "Add ride"
daybars last 7 days, sum(ride.km on it)
list ride by day
```


### C6. Labels that match the topic (class `label_leak`): add 300 creates

What is wrong: 13 builds carried strings from another app: "Log study time" in an attendance sheet, "Add homework mark" in a class average, "A bank connection is not possible here" in a budget, "Zakat and tip", "Quiz night", "Puppet" as a bug status. The strings are in v3.1 (section 2).

Shape: the same school, business, health and family topics as C3, with every label, button and title taken from the request's own words. Pair with the drop in section 2 and the leak scan of rule 2.

**Example 1** (ll1)

Request: `attendance sheet for my class`

```
app "Attendance" users slate
table kid name text
table here kid ref kid
state d date = today
count(kid) "students," count(here on d) "present" big
each kid sort name as k
  row card gap 1
    k.name bold grow
    if count(k.here on d) = 0
      button "Mark present" tap add here kid = k
    else
      "Present" color good
form kid, "Add student"
```

**Example 2** (ll2)

Request: `record student marks and show the class average`

```
app "Class marks" school ocean
table student name text
table mark student ref student, subject text, score num 0..100
"Class average" round(avg(mark.score)) big
each student sort name as s
  row card gap 2
    s.name bold grow
    round(avg(s.mark.score)) bold
form student, "Add student"
form mark, "Add mark"
```

**Example 3** (ll3)

Request: `school lunch planner`

```
app "Lunch box" school ocean
table lunch day pick Mon|Tue|Wed|Thu|Fri, dish text, note text?
each options lunch.day as d
  stack card gap 1
    d bold
    each lunch where day = d as l
      row gap 1 tap edit l swipe remove l
        l.dish grow
        l.note faint
form lunch, "Plan a lunch"
```


### C7. Not thin, not padded (class `not_thin`): add 300 creates

Shape: medium requests ("pocket money tracker for my kids", "a simple khata for my customers", "savings") answered with 8 to 14 lines that cover what the request implies (per-child balance, per-customer balance, a goal and a quick-add), no more.

**Example 1** (nt1)

Request: `pocket money tracker for my kids`

```
app "Pocket money" coin mint
table kid name text
table move kid ref kid, amount money, kind pick Got|Spent = Got, note text?
each kid as k
  row card tap edit k
    k.name bold grow
    sum(k.move.amount where kind = Got) - sum(k.move.amount where kind = Spent) big
form kid, "Add child"
form move, "Add entry"
list move by day
```

**Example 2** (nt2)

Request: `savings`

```
app "Savings" coin mint
table deposit amount money 10..1000000
setting goal money = 100000 "Savings goal"
goal sum(deposit.amount), goal, "saved so far"
quick deposit, amount, [1000, 5000, 10000]
form deposit
list deposit by day
```

**Example 3** (nt3)

Request: `a simple khata for my customers`

```
app "Khata" wallet mint
table customer name text, phone text?
table entry customer ref customer, amount money, kind pick Gave|Got
"Customers owe you" sum(entry.amount where kind = Gave) - sum(entry.amount where kind = Got) big
each customer sort name as c
  row card tap edit c
    c.name bold grow
    sum(c.entry.amount where kind = Gave) - sum(c.entry.amount where kind = Got) bold
form customer, "Add customer"
form entry, "Add entry"
```


### C8. Realistic numbers (class `realistic_numbers`): add 300 creates

What is wrong: 6 builds with absurd defaults (a daily study goal of 12 hours, a weekly step goal of 1,000, a height of 18.5 cm, a baby feeding goal copied from the water app, a 2000 ml goal for "8 glasses"). Fix in data: ranges per unit (daily steps 5,000 to 12,000, weekly steps 35,000 to 84,000, study 1 to 5 hours, water 6 to 12 glasses or 1,500 to 3,500 ml, sleep 6 to 9 hours, calories 1,200 to 3,000, height 100 to 220 cm), and when the request gives a number or a unit the program uses it. Audit v3.1 for settings outside these ranges and fix or drop.

**Example 1** (rn1)

Request: `how many hours i studied today`

```
app "Study hours" school ocean
table study subject text?, mins num 1..600
setting goal num = 3 "Daily goal (hours)"
goal sum(study.mins today) / 60, goal, "hours today", "h"
quick study, mins, [30, 60, 90]
form study
daybars last 7 days, sum(study.mins on it) / 60
list study by day
```

**Example 2** (rn2)

Request: `baby feeding`

```
app "Baby feeds" baby mint
table feed ml num 10..300 unit "ml"
stat sum(feed.ml today), "ml today"
stat count(feed today), "feeds today"
quick feed, ml, [60, 90, 120]
form feed
daybars last 7 days, sum(feed.ml on it)
list feed by day
```

**Example 3** (rn3)

Request: `a step counter log with a weekly goal`

```
app "Weekly steps" walk mint
table walk steps num 100..100000 unit "steps"
setting goal num = 70000 "Weekly goal (steps)"
goal sum(walk.steps week), goal, "this week", "steps"
quick walk, steps, [1000, 2000, 5000]
form walk
daybars last 7 days, sum(walk.steps on it)
list walk
```


### C9. Typos and one-word requests (class `typo_short`): add 300 creates

What is wrong: 4 of 23 typo requests built an unrelated app (`expence tracker` became a counter table called `seizure`, `medecine reminder` an antenatal visit planner, `sals report` a flour and cutting app); 6 of 65 one- to three-word requests failed the checker.

Shape: each correct request with 1 to 3 character-level typos (dropped, doubled, swapped letters, phone-keyboard slips), plus the same words in lower case with no spaces or with extra filler ("pls make a ... app"). Target is the program for the corrected request.

**Example 1** (ty1)

Request: `sals report`

```
app "Sales report" chart slate
table sale item text, amount money
stat sum(sale.amount today), "today"
stat sum(sale.amount month), "this month"
form sale, "Add sale"
daybars last 7 days, sum(sale.amount on it)
list sale by day
```

**Example 2** (ty2)

Request: `medecine reminder`

```
app "Medicine" pill plum
table med name text, dose text?, time time
table taken med ref med
remind "Time for your medicine" at med.time
count(taken today) "of" count(med) "taken today" head
each med sort time as m
  row card gap 2 tap edit m swipe remove m
    stack grow
      m.name bold
      m.time m.dose faint
    toggle m.taken
form med, "Add medicine"
```

**Example 3** (ty3)

Request: `expence tracker`

```
app "Expenses" wallet mint
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
stat sum(spend.amount month), "this month"
form spend, "Add expense"
share spend month by category, sum(it.amount), it.key
list spend by day
```


## 4. Edit classes to add

All edit pairs: program before is 4 to 25 lines unless the class says long; the change touches only what the request names; every other line is copied exactly. Add 30% identity-style negatives (see E10). The sizes sum to about 3,700.

### E1. Add a field (class `add_field`): add 500

What is wrong: r3 returned the program unchanged 26 of 68 times and did it right 16 times; r4 ep2 22 of 42 unchanged. When it did add a field it often chose the wrong one (`location` became `note text?`, `category` took the options of another app: `pick Vegetables|Dairy|Home|Other`). Cover: text, long, num with range and unit, money, date, time, bool, pick with 3 to 6 options named in the request, ref. Half of the pairs name the field type, half do not.

**Example 1** (af1)

Edit request: `add a note field` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-table drink ml num 1..5000 unit "ml"
+table drink ml num 1..5000 unit "ml", note text?
```

**Example 2** (af2)

Edit request: `add a field for payment method` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
+table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other, method pick Cash|Card|Other = Cash
```

**Example 3** (af3)

Edit request: `can you add a due date` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
-table task title text, done bool, priority pick Low|Normal|High = Normal
+table task title text, done bool, priority pick Low|Normal|High = Normal, due date?
```


### E2. Add an option to a choice (class `add_option`): add 400

What is wrong: 0 of 13 right in r3 (11 unchanged); v3.1 has 4 such pairs on programs of 12 lines or fewer. Wording variants: "add X as an option", "add X to the choices", "also let me pick X", "I need X too in the list".

**Example 1** (ao1)

Edit request: `add Online as an option` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
+table spend what text, amount money, category pick Food|Bills|Travel|Fun|Online|Other = Other
```

**Example 2** (ao2)

Edit request: `also let me pick Urgent` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
-table task title text, done bool, priority pick Low|Normal|High = Normal
+table task title text, done bool, priority pick Low|Normal|High|Urgent = Normal
```

**Example 3** (ao3)

Edit request: `add Cash to the choices` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-table spend what text, amount money, category pick Food|Bills|Travel|Fun|Card|Other = Card
+table spend what text, amount money, category pick Food|Bills|Travel|Fun|Card|Cash|Other = Card
```


### E3. Remove one thing (class `remove_one`): add 400

What is wrong: 0 of 23 final results (10 unchanged, 7 damaged other lines, 5 correct but blocked by the app guard, APP_BUGS #3). Cover chart, list, totals, goal, form, one field, one option, one button. Wording uses the user's noun ("the graph", "the totals", "the numbers at the top", "the history"), not the line keyword.

**Example 1** (rm1)

Edit request: `remove the chart` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-daybars last 7 days, sum(drink.ml on it)
```

**Example 2** (rm2)

Edit request: `remove the list at the bottom` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-list spend month by day
```

**Example 3** (rm3)

Edit request: `i do not need the goal` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-goal sum(drink.ml today), goal, "today", "ml"
```


### E4. Add a chart or a stat (class `add_chart_stat`): add 400

What is wrong: add chart 23 of 41 right in r3, add stat 16 of 43; failures: unchanged (20), a stat added where a chart was asked ("i want to see a graph" gave `stat sum(...)`), checker failures on `trend` and `daybars` arguments (9). Cover each chart word of the language: daybars, bars, trend, heat, share, goalbars, daygrid, weekdots; and stat, statcard, goal.

**Example 1** (ac1)

Edit request: `add a bar chart of this week` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
+daybars last 7 days, count(task on it)
```

**Example 2** (ac2)

Edit request: `show the average too` on a 5-line program (`app "Weight" scale mint` ...)

Change (`-` old line, `+` new line):
```
+stat round(avg(weigh.kg last 30 days) * 10) / 10, "average, last 30 days"
```

**Example 3** (ac3)

Edit request: `add a count of entries this week` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
+stat count(spend week), "expenses this week"
```


### E5. Sections (class `sections`): add 300

What is wrong: 4 of 29 right in r3. A correct section edit re-indents lines, so the app's 20% guard also blocks it (APP_BUGS #4): fix the guard and add these pairs.

**Example 1** (se1)

Edit request: `split it into sections` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
-goal spent, budget, "spent"
-form spend, "Add expense"
-share spend month by category, sum(it.amount), it.key
-list spend month by day
+section "This month", "budget and spending"
+  if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
+  goal spent, budget, "spent"
+section "Add"
+  form spend, "Add expense"
+section "Where it went", "this month"
+  share spend month by category, sum(it.amount), it.key
+section "History"
+  list spend month by day
```

**Example 2** (se2)

Edit request: `group things into sections with titles` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
-count(task where done = no) "open" head
-each task where done = no sort priority desc as t
-  row card gap 2 tap edit t swipe remove t
-    toggle t.done
-    t.title grow
-form task, "Add task"
+section "Open", "what is left"
+  count(task where done = no) "open" head
+  each task where done = no sort priority desc as t
+    row card gap 2 tap edit t swipe remove t
+      toggle t.done
+      t.title grow
+section "Add"
+  form task, "Add task"
```

**Example 3** (se3)

Edit request: `organise this with section headings` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-goal sum(drink.ml today), goal, "today", "ml"
-quick drink, ml, [250, 500, 750]
-daybars last 7 days, sum(drink.ml on it)
-list drink
+section "Today", "against the goal"
+  goal sum(drink.ml today), goal, "today", "ml"
+  quick drink, ml, [250, 500, 750]
+section "This week"
+  daybars last 7 days, sum(drink.ml on it)
+section "Drinks"
+  list drink
```


### E6. A number changed in plain words (class `setting_value`): add 300 (only if APP_BUGS #5 is not fixed)

What is wrong: "i want to aim for 3000 instead", "make my goal 3000", "set the target to 100" went to the model and came back unchanged 15 of 27 times. Edits carry `set` on the setting line.

**Example 1** (sv1)

Edit request: `i want to aim for 3000 instead` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-setting goal num = 2000 "Daily goal (ml)"
+setting goal num = 3000 "Daily goal (ml)" set
```

**Example 2** (sv2)

Edit request: `make the monthly limit 60000` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-setting budget money = 80000 "Monthly budget"
+setting budget money = 60000 "Monthly budget" set
```

**Example 3** (sv3)

Edit request: `set the target to 100` on a 6-line program (`app "Tasbeeh" beads mint` ...)

Change (`-` old line, `+` new line):
```
-setting target num = 33 "Count to"
+setting target num = 100 "Count to" set
```


### E7. Rename a field, table or option with `was` (class `rename_field`): add 600

What is wrong: 3 of 28 right. The model writes the new name without `was` (the data rules refuse), or writes `was` and breaks the lines that used the old name. A correct pair renames every use (`sum(drink.amount today)`, `quick drink, amount, ...`). v3.1 has 39 such pairs in total. Cover field, table, pick option (`New was Old`), setting.

**Example 1** (rf1)

Edit request: `rename ml to amount` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-table drink ml num 1..5000 unit "ml"
+table drink amount num 1..5000 unit "ml" was ml
-goal sum(drink.ml today), goal, "today", "ml"
-quick drink, ml, [250, 500, 750]
-daybars last 7 days, sum(drink.ml on it)
+goal sum(drink.amount today), goal, "today", "ml"
+quick drink, amount, [250, 500, 750]
+daybars last 7 days, sum(drink.amount on it)
```

**Example 2** (rf2)

Edit request: `call the what field item` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
+table spend item text was what, amount money, category pick Food|Bills|Travel|Fun|Other = Other
```

**Example 3** (rf3)

Edit request: `rename the title field to task` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
-table task title text, done bool, priority pick Low|Normal|High = Normal
+table task task text was title, done bool, priority pick Low|Normal|High = Normal
-    t.title grow
+    t.task grow
```


### E8. Rename a button or label (class `rename_button`): add 400

What is wrong: 6 of 34 right in r3 (20 unchanged); r4 ep2 is better on short programs (15 of 24) but the long-program cases are in E11. v3.1 has 1 such pair on a short program.

**Example 1** (rb1)

Edit request: `rename the Add expense button to Spend` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-form spend, "Add expense"
+form spend, "Spend"
```

**Example 2** (rb2)

Edit request: `the Add task button should say New task` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
-form task, "Add task"
+form task, "New task"
```

**Example 3** (rb3)

Edit request: `change the Add weight button to say Weigh in` on a 5-line program (`app "Weight" scale mint` ...)

Change (`-` old line, `+` new line):
```
-form weigh, "Add weight"
+form weigh, "Weigh in"
```


### E9. Reorder (class `reorder`): add 300

What is wrong: v3.1 has 0 reorder pairs on programs of 12 lines or fewer; 600 on long programs. Only 6 reorder steps were testable in the hunt because short programs rarely have the two parts out of order, so this class needs its own base programs where the order is wrong on purpose.

**Example 1** (ro1)

Edit request: `put the add form at the top` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
+form spend, "Add expense"
-form spend, "Add expense"
```

**Example 2** (ro2)

Edit request: `put the chart above the list` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
+daybars last 7 days, sum(drink.ml on it)
-daybars last 7 days, sum(drink.ml on it)
```

**Example 3** (ro3)

Edit request: `move the totals to the top` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
+stat count(task where done = no), "open"
-stat count(task where done = no), "open"
```


### E10. Vague requests and requests the app cannot do (classes `vague_small`, `cannot_do_identity`): add 400

What is wrong: of 49 vague steps ("make it nicer", "make it simpler", "this is too busy"), 37 came back unchanged (harmless), 6 tried a bigger change that the guards stopped, 3 failed the checker, 3 applied a small change; of 33 requests for email, sync, passwords and banks, the model left the program unchanged 20 times (right) and tried to add an invented `remind` or `when` line 13 times (4 got through). Vague: one small safe change (accent colour, drop one optional line), never a rewrite. Cannot do: the program comes back identical (the app already answers "I couldn't make that change yet").

**Example 1** (vg1)

Edit request: `make it nicer` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-app "Water" drop ocean
+app "Water" drop teal
```

**Example 2** (vg2)

Edit request: `make it simpler` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-share spend month by category, sum(it.amount), it.key
```

**Example 3** (vg3)

Edit request: `this is too busy` on a 9-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
-daybars last 7 days, count(task on it)
```


**Example 1** (id1)

Edit request: `email me a report every week` on a 7-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
(no change: the program comes back exactly as it was)
```

**Example 2** (id2)

Edit request: `sync this with google drive` on a 9-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
(no change: the program comes back exactly as it was)
```

**Example 3** (id3)

Edit request: `add a password lock` on a 8-line program (`app "To do" list slate` ...)

Change (`-` old line, `+` new line):
```
(no change: the program comes back exactly as it was)
```


### E11. Long programs: exact copy (class `long_edit_copy`): add 600 if the format stays, or convert (section 5)

What is wrong: r3 got 1 of 70 long steps right: it rewrote lines it was not asked to touch (`button if(adding, "Close", "Add student") ...` became `button "Close" ...`, `draw 100, 4` became `draw 100, 2`) and the guards then blocked the result. v3.1 has 2,983 long edits already; see REPORT section 4 for how r4 ep2 did with them, which decides whether more of the same helps.

**Example 1** (le1)

Edit request: `the Record game button should say Add result` on a 40-line program (`app "Chess Club" game ink` ...)

Change (`-` old line, `+` new line):
```
-form game, "Record game"
+form game, "Add result"
```

**Example 2** (le2)

Edit request: `change the monthly profit goal to 150000` on a 43-line program (`app "Mandi Trades" paw grey` ...)

Change (`-` old line, `+` new line):
```
-setting target money = 120000 "Monthly profit goal"
+setting target money = 150000 "Monthly profit goal" set
```

**Example 3** (le3)

Edit request: `add Tea as an option for the cost kind` on a 42-line program (`app "Chai Stall" coffee orange` ...)

Change (`-` old line, `+` new line):
```
-table cost what text, amount money, kind pick Milk|Gas|Sugar|Wages|Other = Milk
+table cost what text, amount money, kind pick Milk|Gas|Sugar|Wages|Tea|Other = Milk
```


## 5. Levers: what to do for every failure class, with expected gain

"More pairs" is lever 0 and is already in sections 3 and 4. These seven levers change what the model is asked to do, so the same data goes further. Gains are my **estimates** (percentage points of the metric named in the first column, on the hunt's own set), each with its basis; the evidence I measured is marked **measured**. Do not add them: the same failures are fixed by more than one lever.

### The levers

**L1. Edit as patch operations.** The prompt shows the program with line numbers; the model writes only `replace 7: <line>`, `insert after 7: <line>`, `delete 9`, `move 4-6 after 12`. The app applies it deterministically (and checks the result). Format in `tools/to_patch.py`. **Measured:** all 7,024 v3.1 edit pairs convert and round-trip exactly (100%); median 1 operation (6,366 need one, 7,006 need three or fewer, none more than six); the patch is a median **16 tokens against 173** for the full program (p90 39 against 556), so about 11 times fewer output tokens: faster, and nothing to copy wrongly. The model still writes every new line itself. A reorder is `move`. A rename with `was` is one `replace` of the table line plus `replace` of each line that uses the old name (the model decides which). Add 400 pairs where the right answer is no operation at all (the request cannot be done), written `# none`, so that "unchanged" is a decision and not the cheapest output.

Edit request: `add Online as an option` on a 9-line program

Patch the model would write instead of 9 lines:
```
replace 2:
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Online|Other = Other
```

Edit request: `rename the Add expense button to Spend` on a 9-line program

Patch the model would write instead of 9 lines:
```
replace 7:
form spend, "Spend"
```

Edit request: `the Record game button should say Add result` on a 40-line program

Patch the model would write instead of 40 lines:
```
replace 30:
form game, "Add result"
```

Edit request: `remove the chart` on a 7-line program

Patch the model would write instead of 6 lines:
```
delete 6
```


**L2. A plan line before the program.** `# need: field drink, field ml, goal, quick buttons, chart, list`. Written by the model from the request, **in English even when the request is Roman Urdu or has typos**. Vocabulary: `field NAME`, `setting NAME`, `option A/B/C`, concept words (goal, chart, total month, streak, list, form, reminder, timer, calendar, tick, quick buttons), and `cannot WHAT` for something the app cannot do (information only). The app removes the line before checking and showing the program. Training plans are derived from request plus target program (the plan lists what the request names and the program has) and verified with `tools/plan_check.mjs`. At inference, the plan is a checkable contract: every item must show in the program, and a program line that no plan item explains is a leak. Format change needed in the grammar: one optional `plan-stmt` as the first line. **Measured:** on the six example pairs the plan check passes the right program, and it flags the wrong outputs r3 and r4 ep2 gave for the same requests (r3 mood diary: missing `option happy/ok/sad/angry`, `field note`, `chart month`; r4 ep2 petrol: missing `field odometer`, `mileage`; r4 ep2 for `paani peene ka hisaab`: missing `field drink`, `list`); it passes the one case that was right (live scores by hand). Six cases are an illustration, not a rate: the rate needs the plans for the 407 requests (a day of work, `tools/plan_negative_check.mjs` is the harness).

**Example 1** (pl1)

Request: `paani peene ka hisaab`

```
# need: field drink, field ml, goal, quick buttons, chart, list
app "Paani" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500, 750]
daybars last 7 days, sum(drink.ml on it)
list drink
```

**Example 2** (pl2)

Request: `a mood diary where i pick how i feel`

```
# need: option happy/ok/sad/angry, field note, chart month, list
app "Mood" smile ink
table entry mood pick Happy|Ok|Sad|Angry = Ok, note text?
share entry month by mood, count(it), it.key
form entry, "Add mood"
list entry by day
```

**Example 3** (pl3)

Request: `daily petrol log with litres, price per litre, odometer and a calculated mileage per litre and monthly cost`

```
# need: field litres, field price, field odometer, mileage, total month, list
app "Petrol" car slate
table refuel litres num 1..200, price money, odo num 0..2000000 "Odometer"
let km = max(refuel.odo) - min(refuel.odo)
"Cost this month" sum(refuel month, it.litres * it.price) big
"Mileage" round(km / max(sum(refuel.litres), 1) * 10) / 10 "km per litre" faint
form refuel, "Add refuel"
list refuel by day
```

**Example 4** (pl4)

Request: `sals report`

```
# need: field amount, total today, total month, chart, list
app "Sales report" chart slate
table sale item text, amount money
stat sum(sale.amount today), "today"
stat sum(sale.amount month), "this month"
form sale, "Add sale"
daybars last 7 days, sum(sale.amount on it)
list sale by day
```

**Example 5** (pl5)

Request: `live cricket scores from the internet`

```
# need: cannot internet, field runs, field wickets, list
app "Score sheet" ball ocean
table score runs num 0..999, wickets num 0..10, overs num 0..50
last(score.runs) "/" last(score.wickets) big
"Type the score by hand: Molde apps work without the internet." faint
form score, "Update score"
list score by day
```

**Example 6** (pl6)

Request: `bachon ki fees ka record, kis ne di kis ne nahi`

```
# need: field child, field fee, field paid, total month, list
app "Fees" school ocean
table child name text, fee money
table paid child ref child, amount money
let due_total = sum(child, if(count(it.paid month) = 0, it.fee, 0))
"Fees due this month" due_total big
each child sort name as c
  row card gap 1
    c.name bold grow
    if count(c.paid month) = 0
      c.fee color warn bold
      button "Paid" tap add paid child = c, amount = c.fee
    else
      "Paid" color good
form child, "Add child"
```


**L3. Minimal pairs.** Same topic, different specifics, different programs, shown to the model together (same batch, same epoch): a water tracker in ml with a goal of 2500 and quick buttons for a glass and a bottle against the same app in glasses with a goal of 8 and a weekly chart; an expense tracker with named categories and a per-category chart against one that records who paid and has no categories. The model can only get both right by reading the request. For edits: the same program with two different requests that touch different lines. 1,000 pairs of creates (2,000 rows) and 1,000 edit pairs inside the C3 and E1 to E4 budgets.

**Example 1** (mp1a)

Request: `a water tracker with a daily goal of 2500 ml and quick buttons for a glass and a bottle`

```
app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2500 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500]
list drink
```

**Example 2** (mp1b)

Request: `a water tracker that counts glasses with a goal of 8 a day and a chart of the week`

```
app "Glasses" drop ocean
table drink glasses num 1..20 unit "glasses"
setting goal num = 8 "Daily goal (glasses)"
goal sum(drink.glasses today), goal, "today", "glasses"
quick drink, glasses, [1, 2]
daybars last 7 days, sum(drink.glasses on it)
```

**Example 3** (mp2a)

Request: `expense tracker with categories food, rent and travel and a chart per category`

```
app "Expenses" wallet mint
table spend what text, amount money, category pick Food|Rent|Travel = Food
stat sum(spend.amount month), "this month"
share spend month by category, sum(it.amount), it.key
form spend, "Add expense"
list spend by day
```

**Example 4** (mp2b)

Request: `expense tracker where i write who paid, no categories`

```
app "Expenses" wallet mint
table spend what text, amount money, who text
stat sum(spend.amount month), "this month"
form spend, "Add expense"
list spend by day
```


**L4. Diversity caps.** At most 15 creates per app title and topic (v3.1: 4,067 distinct titles; 213 titles have more than 15 rows and hold 2,305 rows above the cap: "pocket money" 72, "homework" 57, "plant care" 52, "water" 50, "gratitude" 50, "car service" 49, "calls to mom" 48). The freed budget (about 2,300 rows, plus the 1,291 template rows and 1,621 duplicate bodies of section 2) goes to new topics: the long tail of single-purpose tools (calculators, converters, scorers, school tools, shop tools, trade and farm records). Target: at least 1,500 titles that appear fewer than 5 times and zero titles above 15.

**L5. Roman Urdu, mixed and typo requests at real proportions.** 10 to 15% of creates (today under 0.1%). Of those: 50% Roman Urdu names and sentences, 25% English frame with Roman nouns, 25% typos in English. With the plan line (L2) these map to English plans.

**L6. "Can't do that yet" instead of a random app.** A capability word list in the app (internet, camera, gps, map, login, password, whatsapp, sms, email, audio, voice, ai, chatbot, weather, bank, 3d) lets the grammar offer the existing `ask` line for such a request. The model writes `ask "Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?" "Yes, a ride log" "No, never mind"`; the answer, in the existing `Request / Question / Answer` form, then builds the closest offline app. The current rule (`allowAsk` false when the request names a thing) stays for everything else. 300 pairs (150 refusals and 150 follow-ups).

**Example 1** (rq1)

Request: `gps tracker for my bike rides on a map`

```
ask "Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?" "Yes, a ride log" "No, never mind"
```

**Example 2** (rq2)

Request: `an app that sends whatsapp reminders to my customers`

```
ask "Molde apps cannot send messages. Do you want a customer list with a reminder on your own phone?" "Yes, customer list and reminder" "No, never mind"
```

**Example 3** (rq3)

Request: `live cricket scores from the internet`

```
ask "Molde apps work without the internet, so they cannot fetch scores. Do you want a score sheet you fill in?" "Yes, a score sheet" "No, never mind"
```

**Example 4** (rq4)

Request: `gps tracker for my bike rides on a map
Question: Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?
Answer: Yes, a ride log`

```
app "Bike rides" bike ocean
table ride km num 0.1..300, mins num 1..900, route text?
stat sum(ride.km week), "km this week"
form ride, "Add ride"
daybars last 7 days, sum(ride.km on it)
list ride by day
```


**L7. Verifier-driven self-training and best-of-3.** For each new request, sample N = 4 programs from the current model (temperature 0.7, different seeds); keep those that pass **all** gates: checker, formatter, plan coverage (L2), needs present, leak scan, and for calculators the execution test; train on the best one (rejection-sampling fine-tune); where a sample passes and another fails, add the pair for a DPO step (good against bad, same request). This is also the way to produce C4 (repair pairs) at scale. At inference, creates run best-of-3 (the first greedy, two sampled, take the first that passes the gates): costs up to 3 times the time of a create (median 1.45 s on Spark CPU for r3, so about 4.4 s worst case, only for the requests that fail the gates). **Measured so far:** see `controls/summary.txt` (12 tries per line on the failed creates; three sampled creates per request; 126 unchanged edits replayed with sampling).

### Class by lever, with the expected gain

| class (hunt metric, r3) | levers | expected gain | basis |
|---|---|---|---|
| Checker failure (12.3% of creates; strict create rate) | L7 best-of-3 and repair pairs (C4); error-aware retry; table-name grammar fix (APP_BUGS #6) | +4 to +7 points strict (half to two thirds of the 50 failures become builds, and about half of those are right) | partial: see `controls/summary.txt` for how many failed creates pass with 12 tries or a sample; estimate for the right-app share |
| Meaningless formulas (62) | execution gate (C2), L7, L3 | +3 to +5 | estimate: only calculators and formula apps (about 25 of the 62) can be executed; the structural nonsense is only reduced by the leak and plan gates |
| Misses a specific (55 partial) | **L2**, L3, C3 | +6 to +10 | estimate: a third to a half of these are a missing named item that a plan line makes checkable; partial cases become strict |
| Roman Urdu drift (81 requests: 25% strict, 53% zero) | **L5**, L2 (English plan), C1 | roman strict from 25% to 40 to 45% = **+3 to +4 points overall** and +20 on the roman set | measured: the same model on the English translation builds the right topic in 79 of 81 (97%) and checks 79 of 81; strict in English is 42%, so 40 to 45% is the ceiling for data alone |
| Wrong topic, English (17) and typo (4) | L4, L3, template drop, L5 | +2 to +3 | measured: typo-corrected requests are right-topic 23 of 23, so typo drift (4) is fully a data effect; English topic drift is partly capacity |
| Unsupported built as supported (15 requests, 0% strict) | **L6** | +2 to +3 points overall (15 requests at 0% become mostly right) | the 15 are 3.7% of the set; refusal plus offline build counts as right |
| Leaks (13) and r4's unrelated settings | gates (leak scan, plan, L2), drop of 131 leaking rows, template drop | +2 to +3 (r3), larger for r4-like data | the leak strings are present in v3.1 (counts in section 2) |
| Absurd numbers (5), thin (4) | C7, C8, plan numbers (L2) | +1 | small classes |
| **Create total** | all | strict 37% to **55 to 62%** (cap: the English-only strict is 42% today) | sum of the rows above with overlap removed; the target is a bar to test against, not a promise |
| Edits unchanged (39 to 45% of model steps) | **L1** with explicit `# none`, L3 (edit minimal pairs), E1 to E10 pairs, a sampled retry (APP_BUGS #10) | right rate on short chains from 32% to **50 to 60%** | basis: unchanged is the cheapest output of a full-program rewrite; in a patch format it must be chosen. Measured part: the sampled retry control in `controls/summary.txt` |
| Edit checker failures (9 to 12%) | **L1** (the app copies every untouched line; only the new line must pass) | recovers 70% of them: +6 to +8 points | the 37 failures: 31 changed or broke a line other than the one asked (see REPORT section 4); a patch cannot do that |
| Long programs damaged (7 to 10%; 1 of 70 right) | **L1** | from 1% to 40 to 60% on long programs | measured: the 7,024 existing edits convert exactly, the patch is 16 tokens, the program is never re-copied; the r4 ep2 result (2,983 long edits did not help) shows the full-program format cannot be fixed with more data |
| Applied wrong: wrong field, options or place (8 to 10%) | L3, E1 to E4, L1 with named line anchors | +3 to +5 | estimate |
| Rename without `was` (3 of 28 right) | L1 (`replace` of table line with `was` plus uses), E7 pairs, APP_BUGS #7 | from 11% to 40 to 50% on rename steps | estimate; the app-side `was` inference is the safer half |
| Guard false positives, 20% guard, hang, undo wording | **app only** (APP_BUGS #1 to #5) | +1 to +3 points of edits, and the hang is a freeze | measured counts in APP_BUGS |
| **Edit total** | all | model-path right rate from 25% to **55 to 65%**; long programs from 1% to 40%+ | |

## 6. Mix, order and the gate for the next round

- Start from v3.1 minus section 2 (about 17,700 rows). Add C1 to C9 (about 6,400 creates), E1 to E11 (about 3,700 edits, in patch form if L1 is adopted), and the L3, L5, L6 pairs inside those numbers. About 28,000 rows. The capacity limit is real, so if training time matters, drop the 988 appline edits and cap C3 at 1,000.
- Order inside an epoch: shuffle; do not put the new classes at the end.
- **Experiments, in this order, each against the same `cases.jsonl`:** (a) data only, full-program edits (isolates sections 2 to 4); (b) a plus L1 patch edits; (c) b plus L2 plan lines; (d) c plus L7 on top. If (a) does not beat r3, the data is not the problem and the levers are the plan.
- **Gate before anything is called better than r3:** (1) the same `cases.jsonl` run through `tools/hunt.mjs`; (2) a blind A/B of r5 against r3 on the English creates where both pass (the 30-case protocol of `ab/`): r5 must win at least 20 of 30 with at most 2 ties; (3) strict "did what was asked" on the hand-labelled create sample at least 45% overall and at least 40% on Roman Urdu; (4) definite model-path edits at least 50% right on short chains and at least 20% on long chains, with no-op results under 25%; (5) median seconds per create not above 2.5 on Spark CPU with 4 threads (r3 1.45, r4 ep2 1.83).

## 7. A fast automatic intent judge (calibrated against the 407 hand labels)

Built: `tools/judge.py` (features, no model call, runs the 407 in under a second). Agreement with my labels, 5-fold cross-validated on r3: **strict 68.6% (kappa 0.39, AUC 0.76), lenient 82.6% (kappa 0.57)**; the checker-pass-only baseline is 49.1% (kappa 0.15) strict. Trained on r3, tested on the 147 r4 ep2 labels: strict 70.1%, lenient 76.9%. **Weakness, measured:** it prefers r4 ep2 to r3 (62.4% against 56.8% strict on the 407) while my hand labels and blind A/B say the opposite, and it agrees with my blind A/B picks 15 of 28 (chance). It misses the "looks complete but adds unrelated things" failure.

To make it a gate for training runs: (1) add plan coverage in both directions (every plan item in the program, every program setting or label explained by the plan), which targets exactly that failure; (2) put an LLM judge (haiku, with the rubric of REPORT section 8 and the request, program and plan) next to the features, fit a small logistic combination on the 407 + 147 labels, and report cross-validated agreement and the pairwise agreement with the 30 blind A/B picks; the bar to accept it for gating runs: strict agreement at least 80% and pairwise agreement at least 75%; (3) keep a hold-out of 100 new hand labels per round so the judge is re-calibrated and cannot be over-fitted by training against it.
