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

