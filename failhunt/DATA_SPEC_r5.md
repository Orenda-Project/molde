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

**Example 1** (ru1)

Request: `chai ki dukaan ka rozana hisaab, kitne cup bike aur kitna paisa aaya`

```
# need: field cup, option doodh_patti/kadak/green_tea, field qty, field rate, total today, chart, list
app "Chai hisaab" coffee orange
table cup kind pick Doodh_patti|Kadak|Green_tea = Doodh_patti, qty num 1..200 = 1, rate money
stat sum(cup today, it.qty * it.rate), "aaj ka paisa"
stat sum(cup.qty today), "aaj ke cup"
share cup week by kind, sum(it.qty), it.key
form cup, "Naya hisaab"
list cup by day
```

**Example 2** (ru2)

Request: `gaon ki committee mein har banda mahine ka kitna deta hai aur kis ka baqi hai`

```
# need: field banda, field jama, setting hissa, total month, list
app "Committee" users plum
table banda name text
table jama banda ref banda, amount money
setting hissa money = 2000 "Mahine ka hissa"
"Is mahine jama" sum(jama.amount month) big
each banda sort name as b
  row card gap 2
    b.name bold grow
    if(sum(b.jama.amount month) >= hissa, "Ada", "Baqi") color if(sum(b.jama.amount month) >= hissa, good, bad)
    button "Jama" tap add jama banda = b, amount = hissa
form banda, "Naya banda"
```

**Example 3** (ru3)

Request: `mere bachon ke school ki chhuttiyan aur kitne din gaye`

```
app "Chhuttiyan" school ocean
table chhutti child pick Ali|Sara|Hamza = Ali, why text?, on date = today
count(chhutti month) "is mahine chhuttiyan" big
each options chhutti.child as c
  row card
    c bold grow
    count(chhutti month where child = c) "din" faint
form chhutti, "Chhutti likho"
list chhutti by day
```


### C2. Calculators and formulas that mean what they say (class `calculator_semantics`): add 500 creates

What is wrong: 62 builds passed the checker and still computed nonsense (BMI that divides by the wrong thing, an age calculator with "old age" and "new age" settings, a unit converter with options `S25|U25|U50`, a coin flip with a price field, a plot that averages blood pressure by itself). Gemma writes plausible-looking formulas.

Shape: age, date difference, unit conversion (length, weight, money), percentage, discount, tax, tip, EMI, interest, BMI, split bills, zakat, fuel economy, GPA, time zones. Each program is gated by **execution**: load it with `vendor/lang/eval.mjs`, set the states and settings listed in the pair's test (inputs and the expected displayed number), read the formula result, and keep the pair only if it matches. Store the test in `meta.test`. This is the one gate in the whole spec that checks meaning, not form.

**Example 1** (cs1)

Request: `how many days until my exam`

```
app "Exam days" hourglass ocean
setting exam date "Exam date"
let left = exam - today
if left > 0
  left "days to go" big
  floor(left / 7) "weeks and" left % 7 "days" faint
else
  "The exam day has come" head
```

**Example 2** (cs2)

Request: `convert my weight between kilos and pounds`

```
app "Kilos and pounds" scale slate
state kg num = 0
state lb num = 0
field kg "Kilograms"
field lb "Pounds"
"Kilograms in pounds" round(kg * 2.20462 * 10) / 10 big
"Pounds in kilograms" round(lb / 2.20462 * 10) / 10 big
```

**Example 3** (cs3)

Request: `work out the price after a sale and sales tax`

```
app "Sale price" tag mint
state price money = 0
state off num = 25
state tax num = 17
field price "Shelf price"
slider off 0..90
slider tax 0..30
let cut = price * (100 - off) / 100
"After the sale" round(cut) head
"With tax" round(cut * (100 + tax) / 100) big
"You save" round(price - cut) faint
```


### C3. Explicit specifics kept (class `keep_specifics`): add 1,500 creates

What is wrong: 55 builds were the right kind of app and dropped something the user named: pick-one moods became a 1 to 5 number, "glasses" became ml, five named habits were not there, "personal best and total volume" was missing, "change since last month" was nonsense. Numbers (a goal of 2500 ml, a target of 100) were kept most of the time; named fields, options, units and "per person" were not.

Shape: requests that list 2 to 6 specifics: named options, field names, units, a number, a chart type, a total, a streak, a per-person or per-category total. The program must pass the need check of rule 2 for every specific. 400 of the 1,500 are short (1 to 3 words) and must stay small (4 to 10 lines) with no invented extras.

**Example 1** (ks1)

Request: `a log of my cycling rides: distance in km, time in minutes, and which bike, road or mountain`

```
# need: field km, field mins, option road/mountain, total week, km per hour, list
app "Rides" bike slate
table ride km num 0.5..300, mins num 5..900, bike pick Road|Mountain = Road
stat sum(ride.km week), "km this week"
stat round(sum(ride.km month) / max(sum(ride.mins month) / 60, 1) * 10) / 10, "average km per hour"
form ride, "Add ride"
list ride by day
```

**Example 2** (ks2)

Request: `a reading log where i give each book a star rating from 1 to 5 and see my best rated book`

```
# need: field book, field stars, best rating, list
app "Books" book plum
table book title text, author text?, stars num 1..5
"Best rating" max(book.stars) "stars" big
each book sort stars desc as b
  row card tap edit b swipe remove b
    b.title bold grow
    b.stars "stars" faint
form book, "Add book"
```

**Example 3** (ks3)

Request: `tuition fees for three students at 4000, 5000 and 6500 a month, with a tick when each has paid`

```
# need: option hira/zain/maha, field paid, field fee, total, list
app "Tuition" school ocean
table student name pick Hira|Zain|Maha = Hira, paid bool, fee money
let total = sum(student.fee)
"Collected" sum(student.fee where paid = yes) "of" total big
each student sort name as s
  row card gap 2 tap edit s
    toggle s.paid
    s.name bold grow
    s.fee faint
form student, "Add month"
```


### C4. Typed programs for the shapes that fail the checker (class `checker_shapes`): add 1,200 creates

What is wrong: 50 of 407 creates (12%) failed the checker: `E_TYPE` 34 (comparing text with a number, `slider` on a pick, a table where a column was needed, `count` without a condition), `E_UNKNOWN_NAME` 5, `E_DUP` 4, `E_TARGET` 4. Nine of them ran 12 or more resamples and ended in 25 to 57 lines of garbage (`zakat`, `dice`, `tictactoe`, `committee ka hisaab kitab`).

Shape: **on-policy repair pairs.** Run r3 and r4 ep2 on about 6,000 fresh prompts, keep the programs that fail, ask a stronger model to write the correct program for the same request (not to patch the broken one), gate it, add `request -> corrected program`. Shapes that must be covered: calculators with `state` and `field`, dice and random, board games and quizzes with state, committee and ledger programs with `ref` and per-person sums, timers with `every`, anything with `choice` and `slider`. Also 150 pairs where table names are chosen to avoid modifier words (`fill`, `color`, `stroke`, `width`, `height`, `radius`, `opacity`, `thick`) and reserved words (`then`, `as`, `it`).

**Example 1** (ck1)

Request: `a spinner that picks a random student from my class list`

```
app "Pick a student" dice mint
table kid name text
state chosen text = ""
state n num = 0
let total = max(count(kid), 1)
button "Pick" tap set n = random(total) + 1
each kid sort name as k
  if index = n
    k.name big
form kid, "Add student"
```

**Example 2** (ck2)

Request: `a quiz with three questions where i tap an answer and see my score`

```
app "Quiz" trophy plum
table q text text, right pick A|B|C, a text, b text, c text
state i num = 0
state score num = 0
each q sort at as x
  if index = i
    x.text head
    button x.a tap set score = score + if(x.right = A, 1, 0) then set i = i + 1
    button x.b tap set score = score + if(x.right = B, 1, 0) then set i = i + 1
    button x.c tap set score = score + if(x.right = C, 1, 0) then set i = i + 1
"Score" score "of" count(q) faint
form q, "Add question"
```

**Example 3** (ck3)

Request: `a stopwatch that counts a workout and keeps the finished ones in a list`

```
app "Workout clock" timer ink
table done mins num 1..300
state t dur = 0s
state on bool = no
every 1s if on set t = t + 1s
t big
row gap 2
  button "Go" fill good tap set on = yes
  button "Stop" fill bad tap set on = no
  button "Save" tap add done mins = max(1, floor(t / 1m)) then set t = 0s
list done by day
```


### C5. Requests the app cannot do (class `unsupported_offline`): add 300 creates

What is wrong: 15 requests for things Molde cannot do (whatsapp, gps, camera, login, weather, chat, voice, internet scores, bank balance, 3D): none refused, 0 asked, 14 built an unrelated skeleton (a customer counter, a bike commute counter, a rain log, a workout log called "Flappy"). The app cannot ask (`allowAsk` is false when a request has a real word).

Shape: the closest honest offline app, with one line in the app that says what to do by hand. About 100 pairs per kind of limit (needs internet, needs a sensor, needs another person's phone). Pair this with the app-side capability list in section 5 so the user is told first.

**Example 1** (un1)

Request: `show the weather forecast for my city`

```
# need: cannot forecast, field temp, option sunny/cloudy/rain/windy, trend, list
app "Weather notes" cloud ocean
table note day date = today, temp num -10..50, sky pick Sunny|Cloudy|Rain|Windy = Sunny
"Molde apps cannot fetch a forecast: write what you see outside." faint
form note, "Add today"
trend note last 30 days sort day, it.temp
list note by day
```

**Example 2** (un2)

Request: `translate what i type from english to urdu`

```
app "Word pairs" pen plum
table pair english text, urdu text
"Molde apps cannot translate: save the words you learn." faint
form pair, "Add a pair"
list pair
```

**Example 3** (un3)

Request: `tell me when my parcel arrives using the courier website`

```
app "Parcels" bag slate
table parcel what text, courier text, due date?, arrived bool
"Molde apps cannot read courier sites: tick when it arrives." faint
count(parcel where arrived = no) "on the way" big
each parcel where arrived = no sort due as p
  row card gap 2 tap edit p
    toggle p.arrived
    p.what bold grow
    p.courier faint
form parcel, "Add parcel"
```


### C6. Labels that match the topic (class `label_leak`): add 300 creates

What is wrong: 13 builds carried strings from another app: "Log study time" in an attendance sheet, "Add homework mark" in a class average, "A bank connection is not possible here" in a budget, "Zakat and tip", "Quiz night", "Puppet" as a bug status. The strings are in v3.1 (section 2).

Shape: the same school, business, health and family topics as C3, with every label, button and title taken from the request's own words. Each example is the program a leaking model should have written for a request whose r3 or r4 answer carried a leak; the pair itself contains none of the leak strings, which is what the leak scan of rule 2 verifies on the training side. Pair with the drop in section 2.

**Example 1** (ll1)

Request: `who brought what to the family picnic`

```
app "Picnic" food mint
table dish who text, what text, serves num 1..30 = 4
"People fed" sum(dish.serves) big
form dish, "Add a dish"
list dish
```

**Example 2** (ll2)

Request: `my cricket club members and their match fees`

```
app "Club fees" ball ocean
table member name text, fee money, paid bool
"Still to collect" sum(member.fee where paid = no) big
each member sort name as m
  row card gap 2 tap edit m
    toggle m.paid
    m.name bold grow
    m.fee faint
form member, "Add member"
```

**Example 3** (ll3)

Request: `keep track of the plants i water and when`

```
app "Plants" plant mint
table plant name text, every num 1..30 = 3 "Days between waterings"
table watered plant ref plant
each plant sort name as p
  row card gap 2
    p.name bold grow
    "last" last(p.watered.at) faint
    button "Watered" tap add watered plant = p
form plant, "Add plant"
```


### C7. Not thin, not padded (class `not_thin`): add 300 creates

Shape: medium requests ("pocket money tracker for my kids", "a simple khata for my customers", "savings") answered with 8 to 14 lines that cover what the request implies (per-child balance, per-customer balance, a goal and a quick-add), no more.

**Example 1** (nt1)

Request: `the money my sister owes me and what she has paid back`

```
app "Sister" wallet plum
table move kind pick Lent|Paid_back = Lent, amount money, note text?
"She still owes" sum(move.amount where kind = Lent) - sum(move.amount where kind = Paid_back) big
quick move, amount, [500, 1000, 5000]
form move, "Add entry"
list move by day
```

**Example 2** (nt2)

Request: `daily walk count`

```
app "Steps" walk mint
table walk steps num 100..60000 unit "steps"
setting goal num = 8000 "Daily goal"
goal sum(walk.steps today), goal, "today", "steps"
quick walk, steps, [1000, 3000, 5000]
daybars last 7 days, sum(walk.steps on it)
list walk by day
```

**Example 3** (nt3)

Request: `monthly gas and electricity units`

```
app "Utility units" bolt ocean
table reading kind pick Gas|Electricity = Electricity, units num 0..5000, cost money
bars reading month by kind, sum(it.units), it.key
stat sum(reading.cost month), "cost this month"
form reading, "Add reading"
list reading by day
```


### C8. Realistic numbers (class `realistic_numbers`): add 300 creates

What is wrong: 6 builds with absurd defaults (a daily study goal of 12 hours, a weekly step goal of 1,000, a height of 18.5 cm, a baby feeding goal copied from the water app, a 2000 ml goal for "8 glasses"). Fix in data: ranges per unit (daily steps 5,000 to 12,000, weekly steps 35,000 to 84,000, study 1 to 5 hours, water 6 to 12 glasses or 1,500 to 3,500 ml, sleep 6 to 9 hours, calories 1,200 to 3,000, height 100 to 220 cm), and when the request gives a number or a unit the program uses it. Audit v3.1 for settings outside these ranges and fix or drop.

**Example 1** (rn1)

Request: `daily goal for how long i read`

```
app "Reading time" book plum
table sit mins num 5..300 unit "min"
setting goal num = 30 "Daily goal (min)"
goal sum(sit.mins today), goal, "today", "min"
quick sit, mins, [10, 20, 30]
list sit by day
```

**Example 2** (rn2)

Request: `track how much i sleep each night, aim for eight hours`

```
app "Sleep" bed ink
table night hours num 1..16
setting need num = 8 "Hours I aim for"
stat round(avg(night.hours last 7 days) * 10) / 10, "average this week"
goal last(night.hours), need, "last night", "h"
form night, "Add night"
trend night last 30 days sort at, it.hours
```

**Example 3** (rn3)

Request: `body height and weight check`

```
app "Body check" scale mint
state cm num = 165
state kg num = 65
field cm "Height (cm)"
field kg "Weight (kg)"
let bmi = round(kg * 10000 / (cm * cm) * 10) / 10
"Body mass index" bmi big
if bmi < 18.5
  "Under the usual range" color warn
else
  if bmi < 25
    "In the usual range" color good
  else
    "Above the usual range" color warn
```


### C9. Typos and one-word requests (class `typo_short`): add 300 creates

What is wrong: 4 of 23 typo requests built an unrelated app (`expence tracker` became a counter table called `seizure`, `medecine reminder` an antenatal visit planner, `sals report` a flour and cutting app); 6 of 65 one- to three-word requests failed the checker.

Shape: each correct request with 1 to 3 character-level typos (dropped, doubled, swapped letters, phone-keyboard slips), plus the same words in lower case with no spaces or with extra filler ("pls make a ... app"). Target is the program for the corrected request.

**Example 1** (ty1)

Request: `hoem budgat`

```
# need: field spend, option food/bills/school/other, setting limit, chart, list
app "Home budget" home slate
table spend what text, amount money, kind pick Food|Bills|School|Other = Food
setting limit money = 60000 "Monthly limit"
goal sum(spend.amount month), limit, "spent this month"
share spend month by kind, sum(it.amount), it.key
form spend, "Add spending"
list spend month by day
```

**Example 2** (ty2)

Request: `vacine remindr for my baby`

```
app "Baby vaccines" baby mint
table shot name text, due date, done bool
count(shot where done = no) "still to give" big
each shot where done = no sort due as s
  row card gap 2 tap edit s
    toggle s.done
    s.name bold grow
    s.due color if(s.due < today, bad, muted)
remind "A vaccine is due tomorrow" at shot.due - 1d at 9:00
form shot, "Add vaccine"
```

**Example 3** (ty3)

Request: `wekly meel plan`

```
app "Meals" food ocean
table meal day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, dish text
each options meal.day as d
  stack card gap 1
    d bold
    each meal where day = d as m
      row gap 1 tap edit m swipe remove m
        m.dish grow
form meal, "Plan a meal"
```


## 4. Edit classes to add

All edit pairs: program before is 4 to 25 lines unless the class says long; the change touches only what the request names; every other line is copied exactly. Add 30% identity-style negatives (see E10). The sizes sum to about 3,700.

### E1. Add a field (class `add_field`): add 500

What is wrong: r3 returned the program unchanged 26 of 68 times and did it right 16 times; r4 ep2 22 of 42 unchanged. When it did add a field it often chose the wrong one (`location` became `note text?`, `category` took the options of another app: `pick Vegetables|Dairy|Home|Other`). Cover: text, long, num with range and unit, money, date, time, bool, pick with 3 to 6 options named in the request, ref. Half of the pairs name the field type, half do not.

**Example 1** (af1)

Edit request: `i want to note how hard each set felt` on a 5-line program (`app "Gym" dumbbell ink` ...)

Change (`-` old line, `+` new line):
```
-table lift exercise text, kg num 0..300, reps num 1..50
+table lift exercise text, kg num 0..300, reps num 1..50, effort num 1..10
```

**Example 2** (af2)

Edit request: `every job needs the name of who does it` on a 8-line program (`app "Jobs" list slate` ...)

Change (`-` old line, `+` new line):
```
-table job title text, done bool
+table job title text, who text?, done bool
```

**Example 3** (af3)

Edit request: `keep the year each book came out` on a 9-line program (`app "Books" book plum` ...)

Change (`-` old line, `+` new line):
```
-table book title text, author text?, pages num 1..3000, done bool
+table book title text, author text?, pages num 1..3000, year num 1000..2100, done bool
```


### E2. Add an option to a choice (class `add_option`): add 400

What is wrong: 0 of 13 right in r3 (11 unchanged); v3.1 has 4 such pairs on programs of 12 lines or fewer. Wording variants: "add X as an option", "add X to the choices", "also let me pick X", "I need X too in the list".

**Example 1** (ao1)

Edit request: `my gifts need their own heading` on a 6-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-table spend what text, amount money, kind pick Food|Bills|Fun = Food
+table spend what text, amount money, kind pick Food|Bills|Fun|Gifts = Food
```

**Example 2** (ao2)

Edit request: `a fourth dish is coming: biryani is already there, so put in karahi` on a 4-line program (`app "Vote" users ocean` ...)

Change (`-` old line, `+` new line):
```
-table vote choice pick Pizza|Burger|Biryani = Pizza
+table vote choice pick Pizza|Burger|Biryani|Karahi = Pizza
```

**Example 3** (ao3)

Edit request: `sometimes money comes back to a child as a refund` on a 9-line program (`app "Pocket money" coin mint` ...)

Change (`-` old line, `+` new line):
```
-table move kid ref kid, amount money, kind pick Got|Spent = Got
+table move kid ref kid, amount money, kind pick Got|Spent|Refund = Got
```


### E3. Remove one thing (class `remove_one`): add 400

What is wrong: 0 of 23 final results (10 unchanged, 7 damaged other lines, 5 correct but blocked by the app guard, APP_BUGS #3). Cover chart, list, totals, goal, form, one field, one option, one button. Wording uses the user's noun ("the graph", "the totals", "the numbers at the top", "the history"), not the line keyword.

**Example 1** (rm1)

Edit request: `i can do without the line graph` on a 6-line program (`app "Weight" scale ocean` ...)

Change (`-` old line, `+` new line):
```
-trend weigh last 60 days sort at, it.kg
```

**Example 2** (rm2)

Edit request: `take away the little week dots` on a 5-line program (`app "Habit" check ink` ...)

Change (`-` old line, `+` new line):
```
-weekdots count(tick on it) > 0
```

**Example 3** (rm3)

Edit request: `the long history underneath is too much` on a 6-line program (`app "Spending" wallet mint` ...)

Change (`-` old line, `+` new line):
```
-list spend month by day
```


### E4. Add a chart or a stat (class `add_chart_stat`): add 400

What is wrong: add chart 23 of 41 right in r3, add stat 16 of 43; failures: unchanged (20), a stat added where a chart was asked ("i want to see a graph" gave `stat sum(...)`), checker failures on `trend` and `daybars` arguments (9). Cover each chart word of the language: daybars, bars, trend, heat, share, goalbars, daygrid, weekdots; and stat, statcard, goal.

**Example 1** (ac1)

Edit request: `draw my weight lifted over time` on a 5-line program (`app "Gym" dumbbell ink` ...)

Change (`-` old line, `+` new line):
```
+trend lift last 90 days sort at, it.kg
```

**Example 2** (ac2)

Edit request: `how many of my pills did i take today` on a 10-line program (`app "Medicine" pill plum` ...)

Change (`-` old line, `+` new line):
```
+stat count(taken today), "taken today"
```

**Example 3** (ac3)

Edit request: `a bar per day for the focus rounds` on a 5-line program (`app "Focus" timer mint` ...)

Change (`-` old line, `+` new line):
```
+daybars last 7 days, count(round on it)
```


### E5. Sections (class `sections`): add 300

What is wrong: 4 of 29 right in r3. A correct section edit re-indents lines, so the app's 20% guard also blocks it (APP_BUGS #4): fix the guard and add these pairs.

**Example 1** (se1)

Edit request: `give the screen proper headings` on a 9-line program (`app "Books" book plum` ...)

Change (`-` old line, `+` new line):
```
-count(book where done = yes) "finished" big
-each book sort title as b
-  row card tap edit b swipe remove b
-    toggle b.done
-    b.title bold grow
-    b.pages faint
-form book, "Add book"
+section "Progress"
+  count(book where done = yes) "finished" big
+section "My books"
+  each book sort title as b
+    row card tap edit b swipe remove b
+      toggle b.done
+      b.title bold grow
... (3 more changed lines)
```

**Example 2** (se2)

Edit request: `put the rent part and the tenants part under their own titles` on a 10-line program (`app "Rent" home slate` ...)

Change (`-` old line, `+` new line):
```
-"Collected" sum(paid.amount month) big
-each tenant sort name as t
-  row card gap 2
-    t.name bold grow
-    if(sum(t.paid.amount month) >= rent, "Paid", "Due") color if(sum(t.paid.amount month) >= rent, good, bad)
-form tenant, "Add tenant"
+section "This month"
+  "Collected" sum(paid.amount month) big
+section "Tenants"
+  each tenant sort name as t
+    row card gap 2
+      t.name bold grow
+      if(sum(t.paid.amount month) >= rent, "Paid", "Due") color if(sum(t.paid.amount month) >= rent, good, bad)
+  form tenant, "Add tenant"
```

**Example 3** (se3)

Edit request: `split this into cards, one for the sleep numbers and one for the chart` on a 6-line program (`app "Sleep" bed ink` ...)

Change (`-` old line, `+` new line):
```
-avg7 big
-daybars last 7 days, sum(night on it, (it.woke - it.slept) / 1h)
+section "Average"
+  avg7 big
+section "Last week"
+  daybars last 7 days, sum(night on it, (it.woke - it.slept) / 1h)
```


### E6. A number changed in plain words (class `setting_value`): add 300 (only if APP_BUGS #5 is not fixed)

What is wrong: "i want to aim for 3000 instead", "make my goal 3000", "set the target to 100" went to the model and came back unchanged 15 of 27 times. Edits carry `set` on the setting line.

**Example 1** (sv1)

Edit request: `a full round is 108 for me` on a 9-line program (`app "Tasbeeh" beads mint` ...)

Change (`-` old line, `+` new line):
```
-setting target num = 33 "Count to"
+setting target num = 108 "Count to" set
```

**Example 2** (sv2)

Edit request: `rent goes up to 18000 next month` on a 10-line program (`app "Rent" home slate` ...)

Change (`-` old line, `+` new line):
```
-setting rent money = 15000 "Monthly rent"
+setting rent money = 18000 "Monthly rent" set
```

**Example 3** (sv3)

Edit request: `i am aiming at a lakh and a half now` on a 9-line program (`app "Savings" coin mint` ...)

Change (`-` old line, `+` new line):
```
-setting goal money = 100000 "Savings goal"
+setting goal money = 150000 "Savings goal" set
```


### E7. Rename a field, table or option with `was` (class `rename_field`): add 600

What is wrong: 3 of 28 right. The model writes the new name without `was` (the data rules refuse), or writes `was` and breaks the lines that used the old name. A correct pair renames every use (`sum(drink.amount today)`, `quick drink, amount, ...`). v3.1 has 39 such pairs in total. Cover field, table, pick option (`New was Old`), setting.

**Example 1** (rf1)

Edit request: `the bed time field should just be called bedtime` on a 6-line program (`app "Sleep" bed ink` ...)

Change (`-` old line, `+` new line):
```
-table night slept time, woke time
-let avg7 = sum(night last 7 days, (it.woke - it.slept)) / count(night last 7 days)
+table night bedtime time was slept, woke time
+let avg7 = sum(night last 7 days, (it.woke - it.bedtime)) / count(night last 7 days)
-daybars last 7 days, sum(night on it, (it.woke - it.slept) / 1h)
+daybars last 7 days, sum(night on it, (it.woke - it.bedtime) / 1h)
```

**Example 2** (rf2)

Edit request: `the name of the person should be called "who"` on a 7-line program (`app "Birthdays" gift plum` ...)

Change (`-` old line, `+` new line):
```
-table person name text, birthday date
+table person who text was name, birthday date
-    p.name bold grow
+    p.who bold grow
```

**Example 3** (rf3)

Edit request: `rename the cost kind choices heading to "group"` on a 10-line program (`app "Shop costs" bag ocean` ...)

Change (`-` old line, `+` new line):
```
-table cost what text, amount money, kind pick Milk|Gas|Wages = Milk
+table cost what text, amount money, group pick Milk|Gas|Wages = Milk was kind
-each options cost.kind as k
+each options cost.group as k
-    sum(cost.amount month where kind = k) faint
+    sum(cost.amount month where group = k) faint
```


### E8. Rename a button or label (class `rename_button`): add 400

What is wrong: 6 of 34 right in r3 (20 unchanged); r4 ep2 is better on short programs (15 of 24) but the long-program cases are in E11. v3.1 has 1 such pair on a short program.

**Example 1** (rb1)

Edit request: `the Add person button should say Remember` on a 7-line program (`app "Birthdays" gift plum` ...)

Change (`-` old line, `+` new line):
```
-form person, "Add person"
+form person, "Remember"
```

**Example 2** (rb2)

Edit request: `rename the plus button to Add one more` on a 9-line program (`app "Stock" package slate` ...)

Change (`-` old line, `+` new line):
```
-    button "+" tap set i.qty = i.qty + 1
+    button "Add one more" tap set i.qty = i.qty + 1
```

**Example 3** (rb3)

Edit request: `make the pill button read Took it` on a 10-line program (`app "Medicine" pill plum` ...)

Change (`-` old line, `+` new line):
```
-form med, "Add medicine"
+form med, "Took it"
```


### E9. Reorder (class `reorder`): add 300

What is wrong: v3.1 has 0 reorder pairs on programs of 12 lines or fewer; 600 on long programs. Only 6 reorder steps were testable in the hunt because short programs rarely have the two parts out of order, so this class needs its own base programs where the order is wrong on purpose.

**Example 1** (ro1)

Edit request: `chart first, then the list` on a 6-line program (`app "Weight" scale ocean` ...)

Change (`-` old line, `+` new line):
```
+trend weigh last 60 days sort at, it.kg
+form weigh, "Add weight"
-form weigh, "Add weight"
-trend weigh last 60 days sort at, it.kg
```

**Example 2** (ro2)

Edit request: `the form should come before the totals` on a 9-line program (`app "Pocket money" coin mint` ...)

Change (`-` old line, `+` new line):
```
+form kid, "Add child"
+form move, "Add entry"
-form kid, "Add child"
-form move, "Add entry"
```

**Example 3** (ro3)

Edit request: `show how many are open above the list of jobs` on a 8-line program (`app "Jobs" list slate` ...)

Change (`-` old line, `+` new line):
```
+stat count(job where done = no), "open"
-stat count(job where done = no), "open"
```


### E10. Vague requests and requests the app cannot do (classes `vague_ask`, `cannot_do_ask`): add 400

What is wrong: of 49 vague steps ("make it nicer", "make it simpler", "this is too busy"), 37 came back unchanged with no message, 6 tried a bigger change that the guards stopped, 3 failed the checker, 3 applied a small change; of 33 requests for email, sync, passwords and banks, the model left the program unchanged 20 times and tried to add an invented `remind` or `when` line 13 times (4 got through). Silent no-ops are not acceptable teaching data: the user must be told, in plain English, what the app can do instead. So no identity pairs. For a request the app cannot do, and for a vague request, the answer is the existing `ask` line (needs the capability and vague word list of L6, because `allowAsk` is false today for any request with a real word): one plain sentence that says what cannot be done and what can, and answer choices that are real edits. The `Edit request / Question / Answer` form then makes the change. Never show the language's own syntax to the user (`was`, `pick ...`, `table`); the app's data-rule refusal text is a separate bug (APP_BUGS #11).

**Example 1** (id1)

Edit request: `send my spending to my accountant by email each friday` on a 6-line program (`app "Daily spend" wallet ink` ...)

Change (`-` old line, `+` new line):
```
-app "Daily spend" wallet ink
-table spend amount money, note text?
-quick spend, amount, [100, 500, 1000]
-stat sum(spend.amount today), "today"
-stat sum(spend.amount month), "this month"
-list spend by day
+ask "Molde apps cannot send email. Do you want a weekly total on this screen that you can read out or screenshot?" "Yes, add a weekly total" "No, leave it as it is"
```

**Example 2** (id2)

Edit request: `send my spending to my accountant by email each friday
Question: Molde apps cannot send email. Do you want a weekly total on this screen that you can read out or screenshot?
Answer: Yes, add a weekly total` on a 6-line program (`app "Daily spend" wallet ink` ...)

Change (`-` old line, `+` new line):
```
+stat sum(spend.amount week), "this week"
```

**Example 3** (id3)

Edit request: `lock the app with my fingerprint` on a 5-line program (`app "Habit" check ink` ...)

Change (`-` old line, `+` new line):
```
-app "Habit" check ink
-table tick
-streak(tick) "day streak" big
-weekdots count(tick on it) > 0
-button "Done today" tap add tick
+ask "Molde apps cannot use the fingerprint reader. Your phone's own lock still protects them. Do you want anything else changed?" "No, that is fine" "Yes, something else"
```


**Example 1** (vg1)

Edit request: `can you make this look prettier` on a 6-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
-app "Water" drop ocean
-table drink ml num 1..5000 unit "ml"
-setting goal num = 2000 "Daily goal (ml)"
-goal sum(drink.ml today), goal, "today", "ml"
-quick drink, ml, [250, 500]
-list drink
+ask "What should look nicer?" "A different colour" "Bigger text" "A chart of the week" "Leave it as it is"
```

**Example 2** (vg2)

Edit request: `it feels crowded` on a 10-line program (`app "Shop costs" bag ocean` ...)

Change (`-` old line, `+` new line):
```
-app "Shop costs" bag ocean
-table cost what text, amount money, kind pick Milk|Gas|Wages = Milk
-setting rent money = 15000 "Monthly rent"
-let total = sum(cost.amount month) + rent
-"This month" total big
-each options cost.kind as k
-  row card
-    k bold grow
-    sum(cost.amount month where kind = k) faint
-form cost, "Add cost"
+ask "What can go?" "The list of costs by kind" "The rent line" "Nothing, keep it"
```

**Example 3** (vg3)

Edit request: `can you make this look prettier
Question: What should look nicer?
Answer: A chart of the week` on a 6-line program (`app "Water" drop ocean` ...)

Change (`-` old line, `+` new line):
```
+daybars last 7 days, sum(drink.ml on it)
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

"More pairs" is lever 0 and is already in sections 3 and 4. These seven levers change what the model is asked to do, so the same data goes further. Every claim below is marked **measured** (a number from this hunt) or **hypothesis** (something an experiment of section 6 must test). I give no percentage target that is not backed by a measurement: the earlier version's 55 to 62% and 55 to 65% were sums of hypotheses and are withdrawn.

### The levers

**L1. Edit as patch operations.** The prompt shows the program with line numbers; the model writes only `replace 7: <line>`, `insert after 7: <line>`, `delete 9`, `move 4-6 after 12`. The app applies it deterministically (and checks the result). Format in `tools/to_patch.py`. **Measured:** all 7,024 v3.1 edit pairs convert and round-trip exactly (100%); median 1 operation (6,366 need one, 7,006 need three or fewer, none more than six); the patch is a median **16 tokens against 173** for the full program (p90 39 against 556), so about 11 times fewer output tokens: faster, and nothing to copy wrongly. The model still writes every new line itself. A reorder is `move`. A rename with `was` is one `replace` of the table line plus `replace` of each line that uses the old name (the model decides which). Add 400 pairs where the right answer is no operation at all (the request cannot be done), written `# none`, so that "unchanged" is a decision and not the cheapest output.

Edit request: `my gifts need their own heading` on a 6-line program

Patch the model would write instead of 6 lines:
```
replace 2:
table spend what text, amount money, kind pick Food|Bills|Fun|Gifts = Food
```

Edit request: `the Add person button should say Remember` on a 7-line program

Patch the model would write instead of 7 lines:
```
replace 7:
form person, "Remember"
```

Edit request: `the Record game button should say Add result` on a 40-line program

Patch the model would write instead of 40 lines:
```
replace 30:
form game, "Add result"
```

Edit request: `i can do without the line graph` on a 6-line program

Patch the model would write instead of 5 lines:
```
delete 4
```


**L2. A plan line before the program.** `# need: field drink, field ml, goal, quick buttons, chart, list`. Written by the model from the request, **in English even when the request is Roman Urdu or has typos**. Vocabulary: `field NAME`, `setting NAME`, `option A/B/C`, concept words (goal, chart, total month, streak, list, form, reminder, timer, calendar, tick, quick buttons), and `cannot WHAT` for something the app cannot do (information only). The app removes the line before checking and showing the program. Training plans are derived from request plus target program (the plan lists what the request names and the program has) and verified with `tools/plan_check.mjs`. At inference, the plan is a checkable contract: every item must show in the program, and a program line that no plan item explains is a leak. Format change needed in the grammar: one optional `plan-stmt` as the first line. **Measured:** on the six example pairs the plan check passes the right program, and it flags the wrong outputs r3 and r4 ep2 gave for the same requests (r3 mood diary: missing `option happy/ok/sad/angry`, `field note`, `chart month`; r4 ep2 petrol: missing `field odometer`, `mileage`; r4 ep2 for `paani peene ka hisaab`: missing `field drink`, `list`); it passes the one case that was right (live scores by hand). Six cases are an illustration, not a rate: the rate needs the plans for the 407 requests (a day of work, `tools/plan_negative_check.mjs` is the harness).

**Example 1** (ru1)

Request: `chai ki dukaan ka rozana hisaab, kitne cup bike aur kitna paisa aaya`

```
# need: field cup, option doodh_patti/kadak/green_tea, field qty, field rate, total today, chart, list
app "Chai hisaab" coffee orange
table cup kind pick Doodh_patti|Kadak|Green_tea = Doodh_patti, qty num 1..200 = 1, rate money
stat sum(cup today, it.qty * it.rate), "aaj ka paisa"
stat sum(cup.qty today), "aaj ke cup"
share cup week by kind, sum(it.qty), it.key
form cup, "Naya hisaab"
list cup by day
```

**Example 2** (ru2)

Request: `gaon ki committee mein har banda mahine ka kitna deta hai aur kis ka baqi hai`

```
# need: field banda, field jama, setting hissa, total month, list
app "Committee" users plum
table banda name text
table jama banda ref banda, amount money
setting hissa money = 2000 "Mahine ka hissa"
"Is mahine jama" sum(jama.amount month) big
each banda sort name as b
  row card gap 2
    b.name bold grow
    if(sum(b.jama.amount month) >= hissa, "Ada", "Baqi") color if(sum(b.jama.amount month) >= hissa, good, bad)
    button "Jama" tap add jama banda = b, amount = hissa
form banda, "Naya banda"
```

**Example 3** (ks1)

Request: `a log of my cycling rides: distance in km, time in minutes, and which bike, road or mountain`

```
# need: field km, field mins, option road/mountain, total week, km per hour, list
app "Rides" bike slate
table ride km num 0.5..300, mins num 5..900, bike pick Road|Mountain = Road
stat sum(ride.km week), "km this week"
stat round(sum(ride.km month) / max(sum(ride.mins month) / 60, 1) * 10) / 10, "average km per hour"
form ride, "Add ride"
list ride by day
```

**Example 4** (ks2)

Request: `a reading log where i give each book a star rating from 1 to 5 and see my best rated book`

```
# need: field book, field stars, best rating, list
app "Books" book plum
table book title text, author text?, stars num 1..5
"Best rating" max(book.stars) "stars" big
each book sort stars desc as b
  row card tap edit b swipe remove b
    b.title bold grow
    b.stars "stars" faint
form book, "Add book"
```

**Example 5** (ks3)

Request: `tuition fees for three students at 4000, 5000 and 6500 a month, with a tick when each has paid`

```
# need: option hira/zain/maha, field paid, field fee, total, list
app "Tuition" school ocean
table student name pick Hira|Zain|Maha = Hira, paid bool, fee money
let total = sum(student.fee)
"Collected" sum(student.fee where paid = yes) "of" total big
each student sort name as s
  row card gap 2 tap edit s
    toggle s.paid
    s.name bold grow
    s.fee faint
form student, "Add month"
```

**Example 6** (un1)

Request: `show the weather forecast for my city`

```
# need: cannot forecast, field temp, option sunny/cloudy/rain/windy, trend, list
app "Weather notes" cloud ocean
table note day date = today, temp num -10..50, sky pick Sunny|Cloudy|Rain|Windy = Sunny
"Molde apps cannot fetch a forecast: write what you see outside." faint
form note, "Add today"
trend note last 30 days sort day, it.temp
list note by day
```

**Example 7** (ty1)

Request: `hoem budgat`

```
# need: field spend, option food/bills/school/other, setting limit, chart, list
app "Home budget" home slate
table spend what text, amount money, kind pick Food|Bills|School|Other = Food
setting limit money = 60000 "Monthly limit"
goal sum(spend.amount month), limit, "spent this month"
share spend month by kind, sum(it.amount), it.key
form spend, "Add spending"
list spend month by day
```


**L3. Minimal pairs.** Same topic, different specifics, different programs, shown to the model together (same batch, same epoch): a water tracker in ml with a goal of 2500 and quick buttons for a glass and a bottle against the same app in glasses with a goal of 8 and a weekly chart; an expense tracker with named categories and a per-category chart against one that records who paid and has no categories. The model can only get both right by reading the request. For edits: the same program with two different requests that touch different lines. 1,000 pairs of creates (2,000 rows) and 1,000 edit pairs inside the C3 and E1 to E4 budgets.

**Example 1** (mp1a)

Request: `a to do list where each job has a due date and the late ones are red`

```
app "Jobs" list ink
table job title text, due date, done bool
count(job where done = no and due < today) "late" head color bad
each job where done = no sort due as j
  row card gap 2 tap edit j swipe remove j
    toggle j.done
    j.title grow
    j.due color if(j.due < today, bad, muted)
form job, "Add job"
```

**Example 2** (mp1b)

Request: `a to do list where i give each job one of three levels and see the urgent ones first`

```
app "Jobs" list slate
table job title text, level pick Low|Medium|Urgent = Medium, done bool
each job where done = no sort level desc as j
  row card gap 2 tap edit j swipe remove j
    toggle j.done
    j.title grow
    j.level color if(j.level = Urgent, bad, muted)
form job, "Add job"
```

**Example 3** (mp2a)

Request: `split a holiday bill between four friends equally`

```
app "Holiday split" users mint
state bill money = 0
state people num = 4
field bill "Total bill"
slider people 2..12
"Each pays" round(bill / max(people, 1)) big
```

**Example 4** (mp2b)

Request: `split a holiday bill where each friend pays for what they ate`

```
app "Who owes" users plum
table item who text, what text, price money
each item sort who as i
  row card gap 2 tap edit i swipe remove i
    i.who bold grow
    i.what faint
    i.price
"Total" sum(item.price) big
form item, "Add item"
```


**L4. Diversity caps.** At most 15 creates per app title and topic (v3.1: 4,067 distinct titles; 213 titles have more than 15 rows and hold 2,305 rows above the cap: "pocket money" 72, "homework" 57, "plant care" 52, "water" 50, "gratitude" 50, "car service" 49, "calls to mom" 48). The freed budget (about 2,300 rows, plus the 1,291 template rows and 1,621 duplicate bodies of section 2) goes to new topics: the long tail of single-purpose tools (calculators, converters, scorers, school tools, shop tools, trade and farm records). Target: at least 1,500 titles that appear fewer than 5 times and zero titles above 15.

**L5. Roman Urdu, mixed and typo requests at real proportions.** 10 to 15% of creates (today under 0.1%). Of those: 50% Roman Urdu names and sentences, 25% English frame with Roman nouns, 25% typos in English. With the plan line (L2) these map to English plans.

**L6. "Can't do that yet" instead of a random app.** A capability word list in the app (internet, camera, gps, map, login, password, whatsapp, sms, email, audio, voice, ai, chatbot, weather, bank, 3d) lets the grammar offer the existing `ask` line for such a request. The model writes `ask "Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?" "Yes, a ride log" "No, never mind"`; the answer, in the existing `Request / Question / Answer` form, then builds the closest offline app. The current rule (`allowAsk` false when the request names a thing) stays for everything else. 300 pairs (150 refusals and 150 follow-ups).

**Example 1** (rq1)

Request: `track my truck on a map while i drive`

```
ask "Molde apps cannot use a map or GPS. Do you want a trip log where you type the distance after each drive?" "Yes, a trip log" "No, never mind"
```

**Example 2** (rq2)

Request: `remind my staff on whatsapp every morning`

```
ask "Molde apps cannot send messages to other people. Do you want a staff list with a morning reminder on your own phone?" "Yes, staff list and reminder" "No, never mind"
```

**Example 3** (rq3)

Request: `track my truck on a map while i drive
Question: Molde apps cannot use a map or GPS. Do you want a trip log where you type the distance after each drive?
Answer: Yes, a trip log`

```
app "Truck trips" car slate
table drive km num 1..2000, from text?, to text?
stat sum(drive.km week), "km this week"
form drive, "Add trip"
daybars last 7 days, sum(drive.km on it)
list drive by day
```


**L7. Verifier-driven self-training and best-of-3.** For each new request, sample N = 4 programs from the current model (temperature 0.7, different seeds); keep those that pass **all** gates: checker, formatter, plan coverage (L2), needs present, leak scan, and for calculators the execution test; train on the best one (rejection-sampling fine-tune); where a sample passes and another fails, add the pair for a DPO step (good against bad, same request). This is also the way to produce C4 (repair pairs) at scale. At inference, creates run best-of-3 (the first greedy, two sampled, take the first that passes the gates): costs up to 3 times the time of a create (median 1.45 s on Spark CPU for r3, so about 4.4 s worst case, only for the requests that fail the gates). **Measured so far:** see `controls/summary.txt` (12 tries per line on the failed creates; three sampled creates per request; 126 unchanged edits replayed with sampling).

### Class by lever: what is measured and what is a hypothesis

| class (r3 hunt metric) | levers | measured | hypothesis to test |
|---|---|---|---|
| Checker failure (50 of 407 = 12.3%) | L7 best-of-3 and repair pairs (C4); error-aware retry; the table-name grammar fix (APP_BUGS #6) | with 12 tries per line 9 of the first 26 failed creates pass (35%); samples control in `controls/summary.txt` when finished | H1: repair pairs plus best-of-3 turn about a third of the failures into builds (about +4 builds per 100 requests), a half of those right |
| Meaningless formulas (62) | execution gate (C2), L7, L3 | nothing yet: no run has tried an executed-data round | H2: only calculators and formula apps (about 25 of the 62) can be executed; the structural nonsense is only reduced by the leak and plan gates |
| Misses a specific (55 partial) | L2, L3, C3 | plan check flags 4 of the 5 wrong outputs of r3 and r4 ep2 on five test requests (`tools/plan_negative_check.mjs`); five cases are an illustration, not a rate | H3: a plan line makes a third to a half of these checkable |
| Roman Urdu drift (81 requests, 25% strict, 53% zero) | L5, L2, C1 | **the same model on the English translation builds the right topic in 79 of 81 (97%)**; English-only strict is 42% | H4: data reaches 40 to 45% strict on Roman Urdu, at most the English-only level |
| Wrong topic English (17), typo (4) | L4, L3, template drop, L5 | typo-corrected requests are right-topic 23 of 23, so typo drift is data | H5: English topic drift is partly capacity; unknown share |
| Unsupported built as supported (15 requests, 0 right) | L6 | 0 of 15 refused today; 1 of 15 sensible | H6: with the capability list and ask, most of the 15 become honest refusals plus the closest offline app |
| Leaks (13) and r4's unrelated settings | gates, drop of 131 leaking rows, template drop | the leak strings are in v3.1 (counts in section 2); r4 ep2 leaks more than r3 (9 against 4 on 147 paired requests) | H7: removing them stops the leaks; test on the same 147 |
| Collapse onto a memorised skeleton (quiz, mosque `Khatam`, ring counter; r3: 2 quiz, 6 mosque, 6 ring counter for requests that did not ask) | L4, L3, template drop | r4 ep2 has fewer (0 quiz, 4 mosque, 0 ring) but more leaks | H8: caps and minimal pairs reduce it |
| Absurd numbers (5), thin (4) | C7, C8, plan numbers | small classes | |
| **Create total** | all | **the measured ceilings are: English-only strict 42% today; Roman Urdu at most the English level; checker failures partly recoverable. Together these support about 45% strict from data alone** | H9: levers L2 and L7 take it above 45%; the gate in section 6 asks for 45% first and treats anything higher as the next target, not a promise |
| Edits unchanged (39 to 45% of model steps; forced suite in the report) | L1 with explicit `# none`, L3 for edits, E1 to E10, a sampled retry (APP_BUGS #10) | the unchanged output is shared across requests on one program and is a model behaviour, not a cache effect (fresh-core replay, `controls/identical_outputs_proof.txt`); the sampled-retry control is in `controls/summary.txt` when finished | H10: in a patch format "unchanged" has to be chosen; the right rate on short chains rises above its 32% |
| Edit checker failures (9 to 12%), long programs damaged (7 to 10%; 1 of 70 right) | L1 | all 7,024 v3.1 edits convert to patches and back exactly; median patch 16 tokens against 173 (tests the **format**, not whether the model can write patches); r4 ep2 shows more full-program long edits do not help (1 of 70 again) | H11: with patches the app copies every untouched line, so these failures cannot occur; the model's patch-writing skill is the open question |
| Applied wrong (8 to 10%), silent change of an untouched line (8 of 119 applied steps in r3, 2 of 134 in r4 ep2) | L3, E1 to E4, L1 with line anchors, a guard that compares meaning (APP_BUGS #12) | counted in the report | H12: patches with line numbers remove the silent rewrite class |
| Rename without `was` (3 of 28 right) | L1, E7, APP_BUGS #7 and #11 | counts | H13: the app-side `was` inference is the safer half |
| Guard false positives, 20% guard, hang, undo wording | app only (APP_BUGS) | counts in APP_BUGS | |
| **Edit total** | all | baseline 25% (82 of 321), of which 32% on short chains and 1 of 70 on long programs | **no target is claimed**: E1 (data only, full-program edits) and E2 (plus L1 patches) of section 6 measure it |

## 6. Mix, order and the gate for the next round

- Start from v3.1 minus section 2 (about 17,700 rows). Add C1 to C9 (about 6,400 creates), E1 to E11 (about 3,700 edits, in patch form if L1 is adopted), and the L3, L5, L6 pairs inside those numbers. About 28,000 rows. The capacity limit is real, so if training time matters, drop the 988 appline edits and cap C3 at 1,000.
- Order inside an epoch: shuffle; do not put the new classes at the end.
- **Experiments, in this order, each against the same `cases.jsonl` and the forced edit suite (`controls/forced_cases.jsonl`):** E1 data only, full-program edits (isolates sections 2 to 4); E2 = E1 plus L1 patch edits; E3 = E2 plus L2 plan lines; E4 = E3 plus L7. If (a) does not beat r3, the data is not the problem and the levers are the plan.
- **Gate before anything is called better than r3:** (1) the same `cases.jsonl` run through `tools/hunt.mjs`; (2) a blind A/B of r5 against r3 on the English creates where both pass (the 30-case protocol of `ab/`): r5 must win at least 20 of 30 with at most 2 ties; (3) strict "did what was asked" on the hand-labelled create sample at least **45%** overall (the measured data-only ceiling; r3 is 36.9%) and at least 40% on Roman Urdu; (4) definite model-path edits: strictly more right than r3's 25.5% overall and 32% on short chains, no-op results below r3's 39%, and long programs above 1 of 70; the real target for edits is whatever experiment E2 shows; (5) median seconds per create not above 2.5 on Spark CPU with 4 threads (r3 1.45, r4 ep2 1.83). Higher bars are set only after E1 and E2 report.

## 7. A fast automatic intent judge (calibrated against the 407 hand labels)

Built: `tools/judge.py` (features, no model call, runs the 407 in under a second). Agreement with my labels, 5-fold cross-validated on r3: **strict 68.6% (kappa 0.39, AUC 0.76), lenient 82.6% (kappa 0.57)**; the checker-pass-only baseline is 49.1% (kappa 0.15) strict. Trained on r3, tested on the 147 r4 ep2 labels: strict 70.1%, lenient 76.9%. **Weakness, measured:** it prefers r4 ep2 to r3 (62.4% against 56.8% strict on the 407) while my hand labels and blind A/B say the opposite, and it agrees with my blind A/B picks 15 of 28 (chance). It misses the "looks complete but adds unrelated things" failure.

To make it a gate for training runs: (1) add plan coverage in both directions (every plan item in the program, every program setting or label explained by the plan), which targets exactly that failure; (2) put an LLM judge (haiku, with the rubric of REPORT section 8 and the request, program and plan) next to the features, fit a small logistic combination on the 407 + 147 labels, and report cross-validated agreement and the pairwise agreement with the 30 blind A/B picks; the bar to accept it for gating runs: strict agreement at least 80% and pairwise agreement at least 75%; (3) keep a hold-out of 100 new hand labels per round so the judge is re-calibrated and cannot be over-fitted by training against it.
