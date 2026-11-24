# 30 random pairs

## 1. create | template:countlog | detailed | b_Prayers on time | 93 tokens

**Request:** Count my prayers. It should have a weekly chart, a target of 35 a week with a progress bar, a separate History tab, days since the last one and entries grouped by day.

Target program:
```
app "Prayers on time" mosque ink
table prayer
setting target num = 35 "Weekly goal"
screen main "Today" home
  goal count(prayer week), target, "this week", "times"
  stat since(prayer), "days since the last one"
  button "Log prayer" tap add prayer
screen past "History" chart
  daybars last 7 days, count(prayer on it)
  log prayer
```

## 2. create | template:mixedlog | typos | e_Expense notes | 35 tokens

**Request:** record my small expenses that also has each entry has item amount (money) and shop (optional) and an optional meom

Target program:
```
app "Expense notes" wallet mint
table note_spend item text, amount money, shop text?, memo text?
form note_spend
list note_spend
```

## 3. edit | edit-template:countlog | plain | b_Reels posted | 30 tokens

**Request:** make the whole thing green

Program before:
```
app "Reels posted" phone ink
table post note text?
stat streak(post), "day streak"
form post
list post
```

Target program:
```
app "Reels posted" phone mint
table post note text?
stat streak(post), "day streak"
form post
list post
```

## 4. create | template:countlog | vague | b_Prayers on time | 76 tokens

**Request:** I want to pray on time, help

Target program:
```
app "Prayers on time" mosque ink
table prayer
setting target num = 35 "Weekly goal"
stat count(prayer today), "today"
goal count(prayer week), target, "this week", "times"
button "Log prayer" tap add prayer
daybars last 7 days, count(prayer on it)
list prayer
```

## 5. create | template:expenses | short | d_Pet costs | 48 tokens

**Request:** can you track my pet's costs that also has an optional note

Target program:
```
app "Pet costs" paw ocean
table pet_cost what text, amount money, note text?
let spent = sum(pet_cost.amount month)
"Spent" spent big
form pet_cost
log pet_cost month
```

## 6. edit | edit-template:todo | plain | g_Bucket list | 119 tokens

**Request:** please make it slate

Program before:
```
app "Bucket list" star ink
table dream_goal title text, done bool, priority pick Low|Normal|High = Normal, due date?
count(dream_goal where done = no) "open" head
each dream_goal where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      t.title bold
      t.due size small color if(t.due < today, bad, muted)
form dream_goal
"Done" faint
list dream_goal where done = yes
```

Target program:
```
app "Bucket list" star slate
table dream_goal title text, done bool, priority pick Low|Normal|High = Normal, due date?
count(dream_goal where done = no) "open" head
each dream_goal where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      t.title bold
      t.due size small color if(t.due < today, bad, muted)
form dream_goal
"Done" faint
list dream_goal where done = yes
```

## 7. create | mutate:name | typos | grocery | 132 tokens

**Request:** grocry list with prices and total pls, need to check before shoping. Name the app "Grocery list Plus".

Target program:
```
app "Grocery list Plus" cart mint
table item name text, price money?, qty num 1.. = 1, got bool
count(item where got = no) "to buy. Total" sumof(item, it.price * it.qty) head
each item where got = no as i
  row card swipe remove i
    toggle i.got
    i.name grow
    i.qty "x" i.price
"Already in the cart" faint
each item where got = yes as i
  row swipe remove i
    toggle i.got
    i.name color muted grow
    i.price color muted
form item
```

## 8. create | mutate:name | detailed | study_exams | 124 tokens

**Request:** Track my revision for CSS exam: subject, topic, hours studied, confidence 1-5, and show weakest topics at the top. Call it Daily CSS Revision.

Target program:
```
app "Daily CSS Revision" school ocean
table topic subject text, name text, hours num 0..500, conf num 1..5
"Weakest topics" head
each topic sort conf top 5
  row card tap edit it
    stack grow
      it.name bold
      it.subject it.hours "h" faint
    "Confidence" it.conf bold color if(it.conf <= 2, bad, ink)
form topic, "Add topic"
"All topics" head
each topic sort conf
  row card tap edit it
    it.subject it.name grow
    it.conf
```

## 9. create | template:expenses | typos | d_Home renovation | 60 tokens

**Request:** hy, track my house renovation plus expenses with what it was for and the amount, an optional note and a chart of the last 7 dys

Target program:
```
app "Home renovation" tool slate
table reno what text, amount money, note text?
let spent = sum(reno.amount month)
"Spent" spent big
form reno
daybars last 7 days, sum(reno.amount on it)
log reno month
```

## 10. create | template:habits | vague | c_Prayer times | 113 tokens

**Request:** I want to be regular in my prayers. Any app that helps?

Target program:
```
app "Prayer times" mosque slate
table namaz name text
table namaz_done namaz ref namaz
let n = count(namaz)
count(namaz_done today) "of" n "done today" head
each namaz
  row card gap 2 tap edit it swipe remove it
    stack grow
      it.name bold
      streak(it.namaz_done) "day streak" faint
    toggle it.namaz_done
form namaz
heat last 70 days, count(namaz_done on it), n
```

## 11. create | template:scoreboard | typos | i_Darts | 156 tokens

**Request:** can you make a scoreboard app pus two big score boxes for mum and dad with plus 1 buttons undo and a new game button a history of every point and the lead between them

Target program:
```
app "Darts" target mint
table point team pick Mum|Dad, pts num 1..500 = 1
let a = sum(point.pts where team = Mum)
let b = sum(point.pts where team = Dad)
row gap 2
  stack card grow align center
    "Mum" bold
    text a big
    button "+1" tap add point team = Mum, pts = 1
  stack card grow align center
    "Dad" bold
    text b big
    button "+1" tap add point team = Dad, pts = 1
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
list point
```

## 12. edit | edit-template:ringcounter | plain | h_b_Goals scored | 150 tokens

**Request:** hey, rename the app to Goals scored Diary

Program before:
```
app "Goals scored" ball plum
table goal_scored
setting target num = 100
let n = count(goal_scored today)
draw width 240 tap add goal_scored
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * clamp(n / target, 0, 1) stroke accent thick 8
  label 50, 46, n big
  label 50, 64, "of" target faint
daybars last 7 days, count(goal_scored on it)
remind "Time for goals" at 8:00, 20:00
```

Target program:
```
app "Goals scored Diary" ball plum
table goal_scored
setting target num = 100
let n = count(goal_scored today)
draw width 240 tap add goal_scored
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * clamp(n / target, 0, 1) stroke accent thick 8
  label 50, 46, n big
  label 50, 64, "of" target faint
daybars last 7 days, count(goal_scored on it)
remind "Time for goals" at 8:00, 20:00
```

## 13. create | mutate:theme | typos | laundry | 98 tokens

**Request:** laundry drop off log, which clothes, pickup date, price paid. Colour: dark and moody.

Target program:
```
app "Laundry" cloud ink
table load clothes text, dropped date = today, pickup date, price money, collected bool
count(load where collected = no) "waiting at the laundry" big
stat sum(load.price month), "paid this month"
form load
each load where collected = no sort pickup
  row card
    it.clothes grow
    "pickup" it.pickup
    it.price bold
    toggle it.collected
log load where collected = yes
```

## 14. create | template:stock | detailed | f_Tool shed | 204 tokens

**Request:** Track my tools. I would like tools with quantity and a minimum level, highlighted when low, an expiry date for each item, red when it is over, a search box, a category (Daily, Weekly, Rare) and a reminder every Saturday morning to check.

Target program:
```
app "Tool shed" tool slate
table tool name text, qty num 0.., low num 0.. = 5, kind pick Daily|Weekly|Rare, expires date?
state q text = ""
let short = countof(tool, it.qty <= it.low)
text short "tools running low" head color if(short > 0, warn, good)
field q "Search"
each tool where has(name, q) sort qty as i
  row card gap 1 tap edit i swipe remove i
    stack grow
      i.name bold color if(i.qty <= i.low, warn, ink)
      i.kind faint
      "Expires" i.expires faint color if(i.expires < today, bad, muted)
    button "-" tap set i.qty = i.qty - 1
    i.qty bold
    button "+" tap set i.qty = i.qty + 1
form tool
remind "Check your tools" at 9:00 on sat
```

## 15. create | template:countlog | typos | b_Date nights | 27 tokens

**Request:** a couter for our date nights that also has a calendar where days I did it are filled in

Target program:
```
app "Date nights" heart ocean
table date
button "Log date" tap add date
calendar date
list date
```

## 16. edit | hand-edit | plain | a2_e_salary_goal | 204 tokens

**Request:** add a monthly goal of 60000 with a bar

Program before:
```
app "Pay" money mint
table shift hours num 0..24 = 8, kind pick Normal|Overtime = Normal
setting rate money = 400 "Hourly rate"
setting mult num = 1.5 "Overtime multiplier"
let normal = sum(shift.hours month where kind = Normal)
let extra = sum(shift.hours month where kind = Overtime)
"Pay this month" normal * rate + extra * rate * mult big
"Normal" normal "h | Overtime" extra "h" faint
quick shift, hours, [4, 8, 10]
button "Overtime 2h" tap add shift hours = 2, kind = Overtime
daybars last 7 days, sum(shift.hours on it)
log shift
```

Target program:
```
app "Pay" money mint
table shift hours num 0..24 = 8, kind pick Normal|Overtime = Normal
setting rate money = 400 "Hourly rate"
setting mult num = 1.5 "Overtime multiplier"
setting aim money = 60000 "Monthly goal"
let normal = sum(shift.hours month where kind = Normal)
let extra = sum(shift.hours month where kind = Overtime)
"Pay this month" normal * rate + extra * rate * mult big
goal normal * rate + extra * rate * mult, aim, "of my goal"
"Normal" normal "h | Overtime" extra "h" faint
quick shift, hours, [4, 8, 10]
button "Overtime 2h" tap add shift hours = 2, kind = Overtime
daybars last 7 days, sum(shift.hours on it)
log shift
```

## 17. edit | edit-template:timer | plain | j_Plank | 55 tokens

**Request:** also remove the goal

Program before:
```
app "Plank" dumbbell ink
table hold
setting length dur = 1m "Plank length"
setting target num = 4 "Daily goal"
timer length, "Plank", add hold then notify "Plank done"
count(hold today) "today" head
goal count(hold today), target, "today", "done"
list hold today
```

Target program:
```
app "Plank" dumbbell ink
table hold
setting length dur = 1m "Plank length"
timer length, "Plank", add hold then notify "Plank done"
count(hold today) "today" head
list hold today
```

## 18. edit | edit-template:mixedlog | plain | e_Expense notes | 77 tokens

**Request:** call it Expense notes Log

Program before:
```
app "Expense notes" wallet mint
table note_spend item text, amount money, shop text?
stat sum(note_spend.amount month), "this month"
form note_spend
daybars last 7 days, sum(note_spend.amount on it)
log note_spend
remind "Time to add small expenses" at 21:00
```

Target program:
```
app "Expense notes Log" wallet mint
table note_spend item text, amount money, shop text?
stat sum(note_spend.amount month), "this month"
form note_spend
daybars last 7 days, sum(note_spend.amount on it)
log note_spend
remind "Time to add small expenses" at 21:00
```

## 19. edit | edit-template:mixedlog | plain | e_Dream journal | 30 tokens

**Request:** Also change the theme to ocean blue

Program before:
```
app "Dream journal" moon slate
table dream title text, story long, vivid num 1..5
form dream
log dream
```

Target program:
```
app "Dream journal" moon ocean
table dream title text, story long, vivid num 1..5
form dream
log dream
```

## 20. create | template:timer | custom_ui | j_Plank | 67 tokens

**Request:** A timer app for my planks. Include a 1 minute timer that counts a plank when it finishes, an optional note for each one and a 5 minute rest timer.

Target program:
```
app "Plank" dumbbell ink
table hold note text?
setting length dur = 1m "Plank length"
timer length, "Plank", add hold then notify "Plank done"
count(hold today) "today" head
timer 5m, "Rest"
list hold today
```

## 21. edit | edit-template:countlog | plain | b_Library visits | 21 tokens

**Request:** can it be blue?

Program before:
```
app "Library visits" book mint
table visit note text?
form visit
list visit
```

Target program:
```
app "Library visits" book ocean
table visit note text?
form visit
list visit
```

## 22. create | oos:ringcounter | detailed | h_b_Headaches | 154 tokens

**Request:** Help me count my headaches. Include one big round button that counts my headaches with a progress ring, my day streak, a notice when I reach the target, a small weekly chart below and an undo button for a wrong tap. And back it up to Google Drive automatically.

Target program:
```
app "Headaches" pill plum
table headache
setting target num = 10
let n = count(headache today)
draw width 240 tap add headache
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * clamp(n / target, 0, 1) stroke accent thick 8
  label 50, 46, n big
  label 50, 64, "of" target faint
button "Undo" tap remove last(headache today)
stat streak(headache), "day streak"
daybars last 7 days, count(headache on it)
when n = target notify "Target reached"
```

## 23. edit | edit-template:quantity | plain | q_Volunteering | 96 tokens

**Request:** Can you add a reminder at 10 at night

Program before:
```
app "Volunteering" users ocean
table shift hours num 0.5..24 unit "h"
stat round(avg(shift.hours last 30 days)), "average entry, last 30 days"
stat sum(shift.hours week), "this week"
quick shift, hours, [1, 2, 4]
form shift
list shift
```

Target program:
```
app "Volunteering" users ocean
table shift hours num 0.5..24 unit "h"
stat round(avg(shift.hours last 30 days)), "average entry, last 30 days"
stat sum(shift.hours week), "this week"
quick shift, hours, [1, 2, 4]
form shift
list shift
remind "Time to log volunteer hours" at 22:00
```

## 24. create | template:countlog | detailed | b_Seizures | 61 tokens

**Request:** quick one: a counter for my son's seizures. Include a big count for today, how many days in a row, a heat map of the last 10 weeks, an optional note each time and entries grouped by day if possible.

Target program:
```
app "Seizures" pill slate
table seizure note text?
stat count(seizure today), "today"
stat streak(seizure), "day streak"
form seizure
heat last 70 days, count(seizure on it), 3
log seizure
```

## 25. create | template:ledger | typos | k_Shared flat | 182 tokens

**Request:** a khata for what flatmates owe that also has a list of flatmates and for each an entry with amount and paid for or paid back showing the balance an optional due date on each enrty a phone number for each person and the date of the last entry under each name

Target program:
```
app "Shared flat" home ocean
table flatmate name text, phone text?
table flat_entry flatmate ref flatmate, amount money, kind pick Paid_for|Paid_back, due date?
"Flat balance" sum(flat_entry.amount where kind = Paid_for) - sum(flat_entry.amount where kind = Paid_back) big
each flatmate as p
  let bal = sum(p.flat_entry.amount where kind = Paid_for) - sum(p.flat_entry.amount where kind = Paid_back)
  stack card tap edit p
    row
      p.name bold grow
      if(bal >= 0, "owes you", "you owe") abs(bal) color if(bal >= 0, good, bad)
    "Last entry" last(p.flat_entry.at) faint
form flatmate, "Add flatmate"
form flat_entry, "Add entry"
log flat_entry
```

## 26. create | template:scoreboard | vague | i_Ludo | 142 tokens

**Request:** we argue about ludo scores. an app for it?

Target program:
```
app "Ludo" dice ocean
table point team pick Red|Blue, pts num 1..500 = 1
let a = sum(point.pts where team = Red)
let b = sum(point.pts where team = Blue)
row gap 2
  stack card grow align center
    "Red" bold
    text a big
    button "+1" tap add point team = Red, pts = 1
  stack card grow align center
    "Blue" bold
    text b big
    button "+1" tap add point team = Blue, pts = 1
button "Undo" tap remove last(point)
button "New game" tap remove all point
```

## 27. create | template:ledger | typos | k_Tuition fees | 158 tokens

**Request:** i need 2 keep a recrd of my students' fees and also a list of students and for each an entry with amount and fee or paid showing the balance a note on each entry and an optional due date on each entry

Target program:
```
app "Tuition fees" school ink
table student name text
table fee_entry student ref student, amount money, kind pick Fee|Paid, due date?, note text?
"Fees pending" sum(fee_entry.amount where kind = Fee) - sum(fee_entry.amount where kind = Paid) big
each student as p
  let bal = sum(p.fee_entry.amount where kind = Fee) - sum(p.fee_entry.amount where kind = Paid)
  stack card tap edit p
    row
      p.name bold grow
      if(bal >= 0, "owes you", "paid ahead") abs(bal) color if(bal >= 0, good, bad)
form student, "Add student"
form fee_entry, "Add entry"
log fee_entry
```

## 28. create | oos:datereminder | short | l_Assignments | 116 tokens

**Request:** I need a assignments tracker, and print a PDF report at the end of the month.

Target program:
```
app "Assignments" school mint
table work title text, subject text?, deadline date, done bool
remind "An assignment is due" at work.deadline
count(work where done = no) "open" head
each work where done = no sort deadline as r
  row card gap 2 tap edit r swipe remove r
    toggle r.done
    stack grow
      r.title bold
      r.deadline size small color if(r.deadline < today, bad, muted)
form work
"Done" faint
list work where done = yes
```

## 29. edit | edit-template:scoreboard | plain | i_Tennis | 189 tokens

**Request:** Now add a list of every point scored

Program before:
```
app "Tennis" ball slate
table point team pick Me|Rival, pts num 1..500 = 1
let a = sum(point.pts where team = Me)
let b = sum(point.pts where team = Rival)
setting winat num = 6 "Play to"
row gap 2
  stack card grow align center
    "Me" bold
    text a big
    button "+1" tap add point team = Me, pts = 1
  stack card grow align center
    "Rival" bold
    text b big
    button "+1" tap add point team = Rival, pts = 1
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Me win!" head color good
if b >= winat
  "Rival win!" head color good
```

Target program:
```
app "Tennis" ball slate
table point team pick Me|Rival, pts num 1..500 = 1
let a = sum(point.pts where team = Me)
let b = sum(point.pts where team = Rival)
setting winat num = 6 "Play to"
row gap 2
  stack card grow align center
    "Me" bold
    text a big
    button "+1" tap add point team = Me, pts = 1
  stack card grow align center
    "Rival" bold
    text b big
    button "+1" tap add point team = Rival, pts = 1
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Me win!" head color good
if b >= winat
  "Rival win!" head color good
list point
```

## 30. create | template:quantity | short | q_Coding | 29 tokens

**Request:** help me log my coding hours

Target program:
```
app "Coding" clock mint
table code hours num 0.5..16 unit "h"
form code
list code
```

