# 40 random pairs

## 1. create | v2:real:create | fuller

**Request:** Most of all I want to see how close I am to my savings goal and the month I will reach it at my current deposits, with one tap deposit buttons to add money quickly.

Target program:
```
app "Savings" coin mint
table deposit amount money, note text?
setting monthly money = 7500 "Saved each month"
setting goal money = 100000
let total = sum(deposit.amount)
let left = goal - total
let nm = if(left <= 0, 0, floor(left / monthly) + if(left % monthly > 0, 1, 0))
total "of" goal big
goal total, goal, "saved"
if(left <= 0, "Goal reached", "You reach it around") if(left <= 0, "", monthname(addmonths(today, nm))) head
quick deposit, amount, [5000]
form deposit
list deposit by day
```

## 2. edit | v3:long-edit:colour | long_edit

**Request:** Change the colour theme from yellow to grey, the yellow is too loud for a page I check during long shifts and grey is easier on the eyes.

Program before:
```
app "Orchard" apple yellow
table picking block pick Mango_A|Mango_B|Guava|Citrus|Pomegranate = Mango_A, crates num 1..300 = 20, grade pick Export|Local|Juice = Local
setting target num = 1200 "Season target (crates)"
setting price money = 900 "Price per crate"
let crates = sum(picking.crates)
topbar "Orchard", picking, "Log picking"
statcard crates, "crates picked of" target, target
row gap 2
  stat crates * price, "value at price"
  stat sum(picking.crates today), "crates today"
  stat sum(picking.crates where grade = Export), "export grade"
section "Crates per block", "season"
  bars picking by block, sum(it.crates), it.key
section "Picking", "last 14 days"
  daybars last 14 days, sum(picking.crates on it)
section "Grade mix"
  share picking by grade, sum(it.crates), it.key
section "Pace", "to reach the target"
  each days last 7 days as d
    row gap 2
      dayname(d) grow
      sum(picking.crates on d) "crates" faint
section "Best day", "this season"
  stat max(days month, sum(picking.crates on it)), "crates in one day"
list picking today, "Nothing picked today. Log the first crates."
section "Crates per block", "against a third of target"
  each options picking.block as v
    row gap 2
      v bold grow
      sum(picking.crates where block = v) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(picking.crates where block = v) / max(target / 3, 1), 0, 1), 4 fill accent radius 2
section "Recent", "tap one to ed
```

Target program:
```
app "Orchard" apple grey
table picking block pick Mango_A|Mango_B|Guava|Citrus|Pomegranate = Mango_A, crates num 1..300 = 20, grade pick Export|Local|Juice = Local
setting target num = 1200 "Season target (crates)"
setting price money = 900 "Price per crate"
let crates = sum(picking.crates)
topbar "Orchard", picking, "Log picking"
statcard crates, "crates picked of" target, target
row gap 2
  stat crates * price, "value at price"
  stat sum(picking.crates today), "crates today"
  stat sum(picking.crates where grade = Export), "export grade"
section "Crates per block", "season"
  bars picking by block, sum(it.crates), it.key
section "Picking", "last 14 days"
  daybars last 14 days, sum(picking.crates on it)
section "Grade mix"
  share picking by grade, sum(it.crates), it.key
section "Pace", "to reach the target"
  each days last 7 days as d
    row gap 2
      dayname(d) grow
      sum(picking.crates on d) "crates" faint
section "Best day", "this season"
  stat max(days month, sum(picking.crates on it)), "crates in one day"
list picking today, "Nothing picked today. Log the first crates."
section "Crates per block", "against a third of target"
  each options picking.block as v
    row gap 2
      v bold grow
      sum(picking.crates where block = v) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(picking.crates where block = v) / max(target / 3, 1), 0, 1), 4 fill accent radius 2
section "Recent", "tap one to edit it"
  each picking top 3 as x empty "Nothing here yet."
    row card gap 2 tap edit x swipe remove x
      stack grow gap 0
        x.block bold
        x.grade faint
      x.crates "crates" bold
```

## 3. create | v2:real:create | hurried

**Request:** volunteer hours each day, goal of 10 hours

Target program:
```
app "Volunteering" users ocean
table shift hours num 0.5..24 unit "h"
setting goal num = 10 "Daily goal (h)"
goal sum(shift.hours today), goal, "today"
quick shift, hours, [1, 2, 4]
form shift
heat last 70 days, sum(shift.hours on it), 10
list shift
```

## 4. edit | v2:real:edit | fuller

**Request:** Each task on the car checklist needs a priority of Low, Normal or High, and Normal is the default. Sort the open tasks so the High ones sit at the top of the list.

Program before:
```
app "Car checklist" car plum
table car_task title text, done bool, due date?
count(car_task where done = no) "open" head
each car_task where done = no sort due as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      t.title bold
      t.due small color if(t.due < today, bad, muted)
form car_task
"Done" faint
list car_task where done = yes
remind "Check your car checklist" at 8:00
```

Target program:
```
app "Car checklist" car plum
table car_task title text, done bool, priority pick Low|Normal|High = Normal, due date?
count(car_task where done = no) "open" head
each car_task where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      t.title bold
      t.due small color if(t.due < today, bad, muted)
form car_task
"Done" faint
list car_task where done = yes
remind "Check your car checklist" at 8:00
```

## 5. create | v2:real:create | fuller

**Request:** On the main page I want a slate list of unpaid bills sorted by due date, each with its name, amount and a tick box for paid, plus a form to add a bill and a reminder.

Target program:
```
app "Bill Dates" bell slate
table bill name text, due date, amount money, paid bool
remind "Bill due" at bill.due
each bill where paid = no sort due
  row card tap edit it
    stack grow
      it.name it.amount bold
      "due" it.due faint color if(it.due < today, bad, muted)
    toggle it.paid
form bill, "Add bill"
```

## 6. create | v2:real:oos | hurried

**Request:** dhikr counter, 33 and 100 buttons, text it to my brother

Target program:
```
app "Rosary" beads ocean
table tasbeeh count num 1..1000 unit "times", note text?
stat sum(tasbeeh.count today), "today"
stat round(avg(tasbeeh.count last 30 days)), "average entry, last 30 days"
quick tasbeeh, count, [33, 100]
form tasbeeh
list tasbeeh by day
remind "Time to log dhikr" at 8:00, 20:00
```

## 7. edit | v3:long-edit:setting | long_edit

**Request:** monthly pieces 24 not 8

Program before:
```
app "Sketchbook" pen orange
table piece title text, medium pick Pencil|Watercolour|Acrylic|Digital|Ink = Pencil, hours num 0.25..40 = 1 unit "h", stars num 1..5 = 3
setting monthly_pieces num = 8 "Pieces per month"
let n = count(piece month)
topbar "Sketchbook", piece, "Add piece"
statcard n, "pieces this month, goal" monthly_pieces, monthly_pieces
row gap 2
  statcard round(sum(piece.hours month) * 10) / 10, "hours painted this month"
  statcard round(avg(piece.stars) * 10) / 10, "average stars"
section "Pieces per month", "last 6 months"
  bars 1..6, count(piece month of addmonths(today, it - 6)), monthname(addmonths(today, it - 6))
section "Mediums", "all pieces"
  share piece by medium, count(it), it.key
section "Hours per medium"
  share piece by medium, sum(it.hours), it.key
section "Satisfaction", "stars over time"
  trend piece last 180 days, it.stars
section "Best pieces", "highest stars"
  each piece sort stars desc top 4 as p empty "No pieces yet."
    row card gap 2 tap edit p
      stack grow gap 0
        p.title bold
        p.medium faint
      p.stars "stars" bold
section "Studio days", "last 5 weeks"
  daygrid last 35 days, sum(piece.hours on it), 2
section "Streak"
  streak(piece) "days with a piece" big
section "Gallery"
  list piece by day, "No pieces yet. Draw something small and add it."
row gap 2
  statcard count(piece week), "entries this week"
  statcard count(piece prev week), "entries last week"
section "Totals", "all time"
  count(piece) "entries 
```

Target program:
```
app "Sketchbook" pen orange
table piece title text, medium pick Pencil|Watercolour|Acrylic|Digital|Ink = Pencil, hours num 0.25..40 = 1 unit "h", stars num 1..5 = 3
setting monthly_pieces num = 24 "Pieces per month" set
let n = count(piece month)
topbar "Sketchbook", piece, "Add piece"
statcard n, "pieces this month, goal" monthly_pieces, monthly_pieces
row gap 2
  statcard round(sum(piece.hours month) * 10) / 10, "hours painted this month"
  statcard round(avg(piece.stars) * 10) / 10, "average stars"
section "Pieces per month", "last 6 months"
  bars 1..6, count(piece month of addmonths(today, it - 6)), monthname(addmonths(today, it - 6))
section "Mediums", "all pieces"
  share piece by medium, count(it), it.key
section "Hours per medium"
  share piece by medium, sum(it.hours), it.key
section "Satisfaction", "stars over time"
  trend piece last 180 days, it.stars
section "Best pieces", "highest stars"
  each piece sort stars desc top 4 as p empty "No pieces yet."
    row card gap 2 tap edit p
      stack grow gap 0
        p.title bold
        p.medium faint
      p.stars "stars" bold
section "Studio days", "last 5 weeks"
  daygrid last 35 days, sum(piece.hours on it), 2
section "Streak"
  streak(piece) "days with a piece" big
section "Gallery"
  list piece by day, "No pieces yet. Draw something small and add it."
row gap 2
  statcard count(piece week), "entries this week"
  statcard count(piece prev week), "entries last week"
section "Totals", "all time"
  count(piece) "entries so far" big
  "This year" count(piece year) faint
  "Last one" since(piece) "days ago" faint
section "Which weekdays", "all time"
  bars ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], count(piece where dayname(at) = it), it
section "Busy days", "last 5 weeks"
  daygrid last 35 days, count(piece on it), 2
section "The numbers", "all time"
  "Average" round(avg(piece.hours) * 10) / 10 "h" big
  "Highest" max(piece.hours) "h" faint
  "Lowest" min(piece.hours) "h" faint
```

## 8. create | v2:real:create | hurried

**Request:** craft stock counter with low warning

Target program:
```
app "Craft stock" gift plum
table craft_item name text, qty num 0.., low num 0.. = 10
let short = count(craft_item, it.qty <= it.low)
short "items running low" head color if(short > 0, warn, good)
each craft_item sort qty as i
  row card gap 1 tap edit i swipe remove i
    stack grow
      i.name bold color if(i.qty <= i.low, warn, ink)
    button "-" tap set i.qty = i.qty - 1
    i.qty bold
    button "+" tap set i.qty = i.qty + 1
form craft_item
```

## 9. create | v2:real:create | hurried

**Request:** flashcard boxes with know and miss btns

Target program:
```
app "Box cards" brain plum
table card front text, back text, box num 1..3 = 1
state lvl num = 1
state flip bool = no
row gap 1
  each [1, 2, 3]
    button "Box" it fill if(lvl = it, accent, soft) tap set lvl = it
"Cards in this box" count(card where box = lvl) faint
each card where box = lvl sort at top 1 as c
  stack card gap 2 tap set flip = not flip
    if flip
      c.back big
    else
      c.front big
  row gap 1
    button "Know" tap set c.box = min(c.box + 1, 3) then set flip = no
    button "Miss" tap set c.box = 1 then set flip = no
form card, "Add card"
```

## 10. create | v2:real:create | hurried

**Request:** pet food and vet costs this month

Target program:
```
app "Pet costs" paw ocean
table pet_cost what text, amount money, note text?
let spent = sum(pet_cost.amount month)
"Spent" spent big
form pet_cost
list pet_cost month by day
```

## 11. create | v2:real:create | hurried

**Request:** who won the tennis match, me or rival

Target program:
```
app "Tennis" ball slate
table point team pick Me|Rival, pts num 1..500 = 1
let a = sum(point.pts where team = Me)
let b = sum(point.pts where team = Rival)
row gap 2
  stack card grow align center
    "Me" bold
    a big
    button "+1" tap add point team = Me, pts = 1
  stack card grow align center
    "Rival" bold
    b big
    button "+1" tap add point team = Rival, pts = 1
button "Undo" tap remove last(point)
button "New game" tap remove all point
```

## 12. edit | v3:long-edit:remove | long_edit

**Request:** I don't need the restock section, it's five lines I never act on because the stock comes in on its own schedule, so please drop it from the page

Program before:
```
app "Boutique" tag purple
table dress name text, size pick S|M|L|XL = M, qty num 0.. = 5, price money, cost money
table sale dress ref dress, price money
setting low num = 2 "Low stock at"
let profit = sum(sale, it.price - it.dress.cost)
topbar "Boutique", dress, "Add dress"
statcard profit, "profit from" count(sale) "sales"
row gap 2
  stat sum(sale.price today), "sold today"
  stat sum(dress, it.qty * it.cost), "money in stock"
  stat count(dress where qty <= low), "need restocking"
section "Dresses", "tap Sell when one goes out"
  each dress sort name as d empty "No dresses yet. Add your first design with Add dress."
    row card gap 2 tap edit d swipe remove d
      stack grow gap 0
        d.name bold color if(d.qty <= low, warn, ink)
        d.size "-" d.price faint
      d.qty bold
      button "Sell" tap set d.qty = d.qty - 1 then add sale dress = d, price = d.price
section "Sales", "last 7 days"
  daybars last 7 days, sum(sale.price on it)
section "Profit by size"
  share sale by dress.size, sum(it, it.price - it.dress.cost), it.key
section "Best sellers", "number sold"
  bars dress sort count(it.sale) desc top 5, count(it.sale), it.name
section "Restock", "at or below the low level"
  each dress where qty <= low as d empty "Nothing to restock."
    row gap 2
      d.name d.size bold grow
      d.qty "left" faint color warn
section "Stock per size", "pieces on the rack"
  each options dress.size as v
    row gap 2
      v bold grow
      sum(dress.qty where size = v)
```

Target program:
```
app "Boutique" tag purple
table dress name text, size pick S|M|L|XL = M, qty num 0.. = 5, price money, cost money
table sale dress ref dress, price money
setting low num = 2 "Low stock at"
let profit = sum(sale, it.price - it.dress.cost)
topbar "Boutique", dress, "Add dress"
statcard profit, "profit from" count(sale) "sales"
row gap 2
  stat sum(sale.price today), "sold today"
  stat sum(dress, it.qty * it.cost), "money in stock"
  stat count(dress where qty <= low), "need restocking"
section "Dresses", "tap Sell when one goes out"
  each dress sort name as d empty "No dresses yet. Add your first design with Add dress."
    row card gap 2 tap edit d swipe remove d
      stack grow gap 0
        d.name bold color if(d.qty <= low, warn, ink)
        d.size "-" d.price faint
      d.qty bold
      button "Sell" tap set d.qty = d.qty - 1 then add sale dress = d, price = d.price
section "Sales", "last 7 days"
  daybars last 7 days, sum(sale.price on it)
section "Profit by size"
  share sale by dress.size, sum(it, it.price - it.dress.cost), it.key
section "Best sellers", "number sold"
  bars dress sort count(it.sale) desc top 5, count(it.sale), it.name
section "Stock per size", "pieces on the rack"
  each options dress.size as v
    row gap 2
      v bold grow
      sum(dress.qty where size = v) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(dress.qty where size = v) / max(sum(dress.qty), 1), 0, 1), 4 fill accent radius 2
section "Just added", "tap one to edit it"
  each dress top 3 as x empty "Nothing here yet."
    row card gap 2 tap edit x swipe remove x
      stack grow gap 0
        x.name bold
        x.size faint
      x.qty bold
```

## 13. create | v2:v1:hand | detailed

**Request:** Show how much water I drank each month of the year as a bar chart with the month names under the bars, and the yearly total with thousands separators.

Target program:
```
app "Water Year" drop ocean
table drink ml num 1..3000 unit "ml"
(sum(drink.ml year)) "ml this year" big
plot 0..12, 0..max(1..12, sum(drink.ml month of addmonths(today, it - 12))) axes
  each 1..12
    rect index + 0.15, 0, 0.7, sum(drink.ml month of addmonths(today, it - 12)) fill accent radius 2
    tick index + 0.5, monthname(addmonths(today, it - 12))
form drink
```

## 14. create | v2:real:create | hurried

**Request:** meditaton timer 10 mins daily streak

Target program:
```
app "Meditation" moon mint
table sit_done
setting length dur = 10m "Breathe length"
timer length, "Breathe", add sit_done then notify "Breathe done"
count(sit_done today) "today" head
stat streak(sit_done), "day streak"
list sit_done today
```

## 15. create | v2:real:create | fuller

**Request:** I have machines to keep serviced, so please include: a form to add a machine, a Serviced button when one is due, and a Last serviced line, for each machine.

Target program:
```
app "Machine service" tool slate
table machine name text, every num 1..365 = 90 "Service every (days)"
table service machine ref machine, note text?
each machine sort name as m empty "Add your machines first"
  row card gap 2 tap edit m
    stack grow
      m.name bold
      "Last serviced" plural(since(m.service), "day") "ago" faint
    if due(m.service, m.every)
      button "Serviced" tap add service machine = m
    else
      "OK" color good
form machine, "Add machine"
```

## 16. create | v2:real:create | fuller

**Request:** Layout first: a count of this week's sessions at the top. Each one shows its exercise with sets and reps, newest first. A box adds a new session.

Target program:
```
app "Gym Sessions" dumbbell slate
table session exercise text, sets num 1..10 = 3, reps num 1..50 = 10
plural(count(session week), "session") "this week" big
each session week sort at desc as s empty "No sessions yet this week. Time to start!"
  row card tap edit s swipe remove s
    s.exercise bold grow
    join(s.sets, " x ", s.reps) faint
form session
```

## 17. edit | v2:hand2-edit | plain

**Request:** call weekly the instalment

Program before:
```
app "Microloan" coin mint
table borrower2 name text, loan money, weekly money
table weekpay borrower2 ref borrower2, amount money
"Missed this week" count(borrower2, count(it.weekpay week) = 0) big color warn
each borrower2 sort name as b
  let left = b.loan - sum(b.weekpay.amount)
  row card tap edit b
    b.name bold grow
    "left" left
    if count(b.weekpay week) = 0
      "missed" color bad
    else
      "paid" color good
form weekpay, "Weekly payment"
form borrower2, "New borrower"
```

Target program:
```
app "Microloan" coin mint
table borrower2 name text, loan money, instalment money was weekly
table weekpay borrower2 ref borrower2, amount money
"Missed this week" count(borrower2, count(it.weekpay week) = 0) big color warn
each borrower2 sort name as b
  let left = b.loan - sum(b.weekpay.amount)
  row card tap edit b
    b.name bold grow
    "left" left
    if count(b.weekpay week) = 0
      "missed" color bad
    else
      "paid" color good
form weekpay, "Weekly payment"
form borrower2, "New borrower"
```

## 18. edit | v2:real:edit | hurried

**Request:** water glass buddy

Program before:
```
app "Water Glass" cup ocean
table glass
setting goal num = 8 "Glasses per day"
let n = count(glass today)
draw 100, 120 width 160 tap add glass
  rect 26, 110 - 100 * clamp(n / goal, 0, 1), 48, 100 * clamp(n / goal, 0, 1) fill accent opacity 0.7
  path "M25 10v100h50V10" stroke ink thick 2
n "of" goal "glasses" big
"Tap the glass to add one" faint
button "Undo" tap remove last(glass today)
```

Target program:
```
app "Water Glass Buddy" cup ocean
table glass
setting goal num = 8 "Glasses per day"
let n = count(glass today)
draw 100, 120 width 160 tap add glass
  rect 26, 110 - 100 * clamp(n / goal, 0, 1), 48, 100 * clamp(n / goal, 0, 1) fill accent opacity 0.7
  path "M25 10v100h50V10" stroke ink thick 2
n "of" goal "glasses" big
"Tap the glass to add one" faint
button "Undo" tap remove last(glass today)
```

## 19. create | v2:v1:hand | vague

**Request:** a fun game for my kids

Target program:
```
app "Tap the star" star plum
table caught n num 1..9
state spot num = 5
let score = count(caught all)
score "stars caught" big
grid 3 gap 1
  each 1..9 as c
    box height 70 radius 12 fill if(c = spot, accent, soft) tap add caught n = c
button "Move the star" tap set spot = random(9)
button "Start over" tap remove all caught
```

## 20. create | v2:real:oos | fuller

**Request:** Nights in bed before eleven, with a count for today and a day streak. Please sync the streak so my mum can see how many nights I've made it to bed on time on her own phone.

Target program:
```
app "Sleep before 11" bed ink
table early
screen main "Today" home
  stat count(early today), "today"
  stat streak(early), "day streak"
  button "Log night" tap add early
screen past "History" chart
  list early
```

## 21. create | v2:real:create | hurried

**Request:** tally reds and blues goals pls

Target program:
```
app "Football" ball plum
table point team pick Reds|Blues, pts num 1..500 = 1
let a = sum(point.pts where team = Reds)
let b = sum(point.pts where team = Blues)
row gap 2
  stack card grow align center
    "Reds" bold
    a big
    button "+1" tap add point team = Reds, pts = 1
  stack card grow align center
    "Blues" bold
    b big
    button "+1" tap add point team = Blues, pts = 1
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
```

## 22. create | v2:real:create | fuller

**Request:** A circle drawing that counts up every four seconds while it runs, with a Begin button that changes to Stop when it is going, so I can follow the rhythm.

Target program:
```
app "Breathe" leaf mint
state ph num = 0
state go bool = no
every 4s if go set ph = (ph + 1) % 4
draw 100, 100 width 200
  circle 50, 50, 46 stroke soft thick 2
  circle 50, 50, if(ph = 0, 20, if(ph = 1, 40, if(ph = 2, 40, 20))) fill accent opacity 0.7
  label 50, 52, if(ph = 0, "Breathe in", if(ph = 1, "Hold", if(ph = 2, "Breathe out", "Rest"))) head
button if(go, "Stop", "Begin") tap set go = not go
```

## 23. edit | v2:real:edit | fuller

**Request:** The average of the last 30 days on Meditation is not useful to me. Could you take the average entry, last 30 days, off the main page and leave the rest alone?

Program before:
```
app "Meditation" moon slate
table sit mins num 1..180 unit "min", note text?
stat round(avg(sit.mins last 30 days)), "average entry, last 30 days"
stat sum(sit.mins today), "today"
form sit
daybars last 7 days, sum(sit.mins on it)
list sit
```

Target program:
```
app "Meditation" moon slate
table sit mins num 1..180 unit "min", note text?
stat sum(sit.mins today), "today"
form sit
daybars last 7 days, sum(sit.mins on it)
list sit
```

## 24. create | hand3:t1 | custom_ui

**Request:** my houseplants: name, how many days between waterings, and a button to water. the plant should look red when thirsty and green when fine, and show days since water

Target program:
```
app "Plants" plant plum
table plant name text, every num 1..30 = 7
table watering plant ref plant
topbar "Plants", plant, "Add plant"
grid 2 gap 1
  each plant sort name as p empty "No plants yet. Add the first one with its watering interval."
    let ago = since(p.watering)
    stack card gap 1 fill if(due(p.watering, p.every), soft, surface)
      p.name bold
      if(ago >= 0, join(plural(ago, "day"), " since water"), "Never watered") faint
      if due(p.watering, p.every)
        "Thirsty" color bad bold
      else
        "Fine" color good bold
      button "Water" tap add watering plant = p
```

## 25. create | v2:v1:oos:stock | multi_feature

**Request:** hey molde, a art supplies tracker: materials with quantity and a minimum level, highlighted when low, a category (Home, Work, Other), a price for each one and the total value, an expiry date shown red when passed, a reminder every Saturday morning to check and a search box. And print receipts for my customers.

Target program:
```
app "Art supplies" pencil mint
table material name text, qty num 0.., low num 0.. = 5, price money?, kind pick Home|Work|Other, expires date?
state q text = ""
let short = count(material, it.qty <= it.low)
short "materials running low" head color if(short > 0, warn, good)
field q "Search"
each material where has(name, q) sort qty as i
  row card gap 1 tap edit i swipe remove i
    stack grow
      i.name bold color if(i.qty <= i.low, warn, ink)
      i.kind faint
      "Expires" i.expires faint color if(i.expires < today, bad, muted)
    button "-" tap set i.qty = i.qty - 1
    i.qty bold
    button "+" tap set i.qty = i.qty + 1
"Stock value" sum(material, it.qty * it.price) faint
form material
remind "Check your materials" at 9:00 on sat
```

## 26. edit | v3:long-edit:setting | long_edit

**Request:** The meals per day setting should start at 1.6 instead of 2, since I eat smaller meals more often and the old number is not how I actually eat.

Program before:
```
app "Dog walks" paw orange
table walk mins num 5..240 unit "min", route text?, mood pick Calm|Happy|Wild = Happy
table meal grams num 20..600 unit "g"
setting weekly_mins num = 420 "Walk minutes per week"
setting meals_per_day num = 2
let wk = sum(walk.mins week)
remind "Dinner time for the dog" at 18:30
topbar "Dog walks", walk, "Log walk"
statcard wk, "min walked this week", weekly_mins
row gap 2
  statcard streak(walk), "day streak"
  statcard best(walk), "best streak"
  statcard count(walk month), "walks this month"
section "Last 7 days", "minutes"
  goalbars last 7 days, sum(walk.mins on it), weekly_mins / 7
section "Walk calendar", "last 5 weeks"
  daygrid last 35 days, count(walk on it), 2
section "Moods on walks", "this month"
  share walk month by mood, count(it), it.key
section "Feeding", "today:" count(meal today) "of" meals_per_day "meals"
  row gap 1
    button "Half 100 g" tap add meal grams = 100
    button "Full 200 g" tap add meal grams = 200
  "Fed today" sum(meal.grams today) "g" faint
  list meal today, "Not fed yet today."
section "Longest walk", "all time"
  max(walk.mins) "min" big
  "Average walk" round(avg(walk.mins)) "min" faint
section "Recent walks"
  each walk top 8 as w empty "No walks yet. Even ten minutes counts."
    row card gap 2 tap edit w swipe remove w
      stack grow gap 0
        w.route bold
        w.mins "min" w.mood faint
      w.at faint
section "Weekly minutes", "this week" wk "of" weekly_mins
  goal wk, weekly_mins, "minutes wal
```

Target program:
```
app "Dog walks" paw orange
table walk mins num 5..240 unit "min", route text?, mood pick Calm|Happy|Wild = Happy
table meal grams num 20..600 unit "g"
setting weekly_mins num = 420 "Walk minutes per week"
setting meals_per_day num = 1.6 set
let wk = sum(walk.mins week)
remind "Dinner time for the dog" at 18:30
topbar "Dog walks", walk, "Log walk"
statcard wk, "min walked this week", weekly_mins
row gap 2
  statcard streak(walk), "day streak"
  statcard best(walk), "best streak"
  statcard count(walk month), "walks this month"
section "Last 7 days", "minutes"
  goalbars last 7 days, sum(walk.mins on it), weekly_mins / 7
section "Walk calendar", "last 5 weeks"
  daygrid last 35 days, count(walk on it), 2
section "Moods on walks", "this month"
  share walk month by mood, count(it), it.key
section "Feeding", "today:" count(meal today) "of" meals_per_day "meals"
  row gap 1
    button "Half 100 g" tap add meal grams = 100
    button "Full 200 g" tap add meal grams = 200
  "Fed today" sum(meal.grams today) "g" faint
  list meal today, "Not fed yet today."
section "Longest walk", "all time"
  max(walk.mins) "min" big
  "Average walk" round(avg(walk.mins)) "min" faint
section "Recent walks"
  each walk top 8 as w empty "No walks yet. Even ten minutes counts."
    row card gap 2 tap edit w swipe remove w
      stack grow gap 0
        w.route bold
        w.mins "min" w.mood faint
      w.at faint
section "Weekly minutes", "this week" wk "of" weekly_mins
  goal wk, weekly_mins, "minutes walked this week", "min"
section "Rest days", "this month"
  count(days month, count(walk on it) = 0) big
  "days without a walk" faint
section "Favourite routes"
  share walk by route, count(it), it.key
row gap 2
  statcard count(walk week), "entries this week"
  statcard count(walk prev week), "entries last week"
```

## 27. create | v2:real:create | fuller

**Request:** I need to see my progress each day, so a big number shows laps today, with a +1 lap button, a drawing of rectangles, an Undo button and an All time count.

Target program:
```
app "Laps" drop ocean
table lap
let n = count(lap today)
"Laps today" n big
draw 100, 20
  each 1..min(n, 20) as i
    rect 5 * (i - 1), 4, 4, 12 fill accent radius 1
button "+1 lap" tap add lap
button "Undo" tap remove last(lap today)
"All time" count(lap) "laps" faint
```

## 28. create | v2:v1:hand | typos

**Request:** situp counter with ring for 50 a day

Target program:
```
app "Situps" dumbbell ink
table su reps num 1..200
goal sum(su.reps today), 50, "situps today"
quick su, reps, [5, 10, 20]
"Streak" streak(su) "days" big
"Best streak" best(su) "days" faint
```

## 29. edit | v2:real:edit | hurried

**Request:** make the bike repair app ink

Program before:
```
app "Bike Repair" bike slate
table job customer text, labour money
table part job ref job, name text, cost money
each job as j
  stack card gap 1
    j.customer head
    each j.part
      row
        it.name grow
        it.cost
    row
      "Labour" grow
      j.labour
    row
      "Invoice total" bold grow
      j.labour + sum(j.part.cost) bold big
form job, "New job card"
form part, "Add part"
```

Target program:
```
app "Bike Repair" bike ink
table job customer text, labour money
table part job ref job, name text, cost money
each job as j
  stack card gap 1
    j.customer head
    each j.part
      row
        it.name grow
        it.cost
    row
      "Labour" grow
      j.labour
    row
      "Invoice total" bold grow
      j.labour + sum(j.part.cost) bold big
form job, "New job card"
form part, "Add part"
```

## 30. create | hand3:c3 | detailed

**Request:** bike loan from the shop. first instalment is 5 january, 12 months, total 120000. show instalment amount, the date of each one, how many are left and the date of the last

Target program:
```
app "Instalments" bike blue
setting total money = 120000 "Total to repay"
setting n num 1..36 = 12 "Number of months"
setting first date = 2027-01-05 "First instalment"
let each_amt = total / n
let left = count(1..n, addmonths(first, it - 1) >= today)
statcard each_amt, "a month for" n "months", 0
field total
field n
field first
"Instalments left:" left "of" n head
"Last one on" addmonths(first, n - 1) faint
section "Dates"
  each 1..n as k
    row
      join("No. ", k) grow
      addmonths(first, k - 1)
      if addmonths(first, k - 1) < today
        "paid" color good
      else
        each_amt
```

## 31. create | v2:v1:mutate:name | detailed

**Request:** Islamic study notes: topic, source, date studied, key points, and a revision list for each week, i want to call it My Study notes.

Target program:
```
app "My Study notes" book plum
table note topic text, source text, points long, revised bool
"To revise, by week studied" head
each note where revised = no by week as g
  g.key bold faint
  each g as n
    row card tap edit n
      toggle n.revised
      stack grow
        n.topic bold
        n.source n.at faint
"All notes" head
list note
form note, "Add note"
```

## 32. create | v2:real:create | hurried

**Request:** how many glasses of milk this week

Target program:
```
app "Milk" milk slate
table milk glasses num 1..6 unit "glasses"
stat sum(milk.glasses week), "this week"
stat round(avg(milk.glasses last 30 days)), "average entry, last 30 days"
quick milk, glasses, [1, 2]
form milk
list milk
```

## 33. create | v2:real:create | hurried

**Request:** days since my last trip, i want to log each one

Target program:
```
app "Mileage" car slate
table trip from_place text, to_place text, km num 1..2000, purpose text?
stat since(trip), "days since the last entry"
form trip
list trip
```

## 34. create | v2:real:create | hurried

**Request:** can we keep darts score mum and dad

Target program:
```
app "Darts" target mint
table point team pick Mum|Dad, pts num 1..500 = 1
let a = sum(point.pts where team = Mum)
let b = sum(point.pts where team = Dad)
row gap 2
  stack card grow align center
    "Mum" bold
    a big
    button "+1" tap add point team = Mum, pts = 1
    row gap 1
      button "+5" tap add point team = Mum, pts = 5
  stack card grow align center
    "Dad" bold
    b big
    button "+1" tap add point team = Dad, pts = 1
    row gap 1
      button "+5" tap add point team = Dad, pts = 5
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
list point
```

## 35. create | v2:hand2 | vague

**Request:** barber shop haircuts and tips

Target program:
```
app "Barber" user slate
table cut kind pick Haircut|Shave|Both|Kids = Haircut, price money = 300, tip money = 0
let cash_today = sum(cut.price today) + sum(cut.tip today)
cash_today "today" big
"Tips" sum(cut.tip today) faint
"Customers" count(cut today) faint
quick cut, kind, [Haircut, Shave]
form cut
daybars last 7 days, count(cut on it)
```

## 36. edit | v2:real:edit | fuller

**Request:** Could the home screen show a weekly limit of 7 with a count for this week, so I can see how close I am?

Program before:
```
app "Seizures" pill slate
table seizure note text?
screen main "Today" home
  stat since(seizure), "days since the last one"
  form seizure
screen past "History" chart
  calendar seizure
  list seizure
```

Target program:
```
app "Seizures" pill slate
table seizure note text?
setting target num = 7 "Weekly limit"
screen main "Today" home
  stat since(seizure), "days since the last one"
  goal count(seizure week), target, "this week", "times"
  form seizure
screen past "History" chart
  calendar seizure
  list seizure
```

## 37. create | v2:v1:hand | detailed

**Request:** Mileage log for work trips. I put the kilometres and the purpose of each trip, the company pays me a rate per km, and I want to see my claim for the month.

Target program:
```
app "Mileage" car mint
table trip km num 1..2000, purpose pick Client|Supplier|Bank|Other = Client
setting rate money = 25 "Rate per km"
"Claim this month" sum(trip.km month) * rate big
sum(trip.km month) "km" faint
share trip month by purpose, sum(it.km), it.key
form trip
list trip by day
```

## 38. edit | v2:real:edit | fuller

**Request:** The subject Chemistry in Study bars should be called Chem now, so rename that choice. Any study that was already logged under Chemistry keeps its option.

Program before:
```
app "Study bars" school ocean
table study subject pick Maths|Physics|Chemistry|English, hours num 0.25..10
plot 0..4, 0..max(sum(study.hours where subject = Maths), 5) axes
  each options study.subject
    rect index + 0.15, 0, 0.7, sum(study.hours where subject = it) fill accent
    tick index + 0.5, it
form study
```

Target program:
```
app "Study bars" school ocean
table study subject pick Maths|Physics|Chem was Chemistry|English, hours num 0.25..10
plot 0..4, 0..max(sum(study.hours where subject = Maths), 5) axes
  each options study.subject
    rect index + 0.15, 0, 0.7, sum(study.hours where subject = it) fill accent
    tick index + 0.5, it
form study
```

## 39. create | v3:multi-turn | multi_turn

**Request:** saved replies for quick answers
Question: What do you want to save for quick replies?
Answer: Reply macros

Target program:
```
app "Macros" note grey
table macro title text, body long
table used macro ref macro
topbar "Macros", macro, "Add macro"
statcard count(used week), "replies sent this week," count(macro, count(it.used) = 0) "macros never used"
each macro sort count(it.used) desc as m empty "No macros yet. Save the reply you type every day."
  stack card gap 1 tap edit m swipe remove m
    row gap 2
      m.title bold grow
      count(m.used) "uses" faint
    m.body faint
    button "Used" tap add used macro = m
```

## 40. create | v2:real:create | hurried

**Request:** tasbeeh counter with round complete note

Target program:
```
app "Tasbeeh" beads mint
table tap
setting lim num = 100 "Round size"
let n = count(tap today)
draw width 240 tap add tap
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % lim) / lim stroke accent thick 8
  label 50, 48, n % lim big
  label 50, 66, "of" lim faint
"Rounds done" floor(n / lim) head
"Total today" n faint
when n > 0 and n % lim = 0 notify "Round complete"
```

