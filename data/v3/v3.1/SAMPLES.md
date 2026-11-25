# 40 random pairs

## 1. edit | v3:long-edit:addchart | long_edit

**Request:** Adding a habit grid for the last 6 weeks as a new section would help me keep track of what I did each day, so please do it.

Program before:
```
app "Bus Seats" bus ocean
table ticket seat num 1..40, name text, fare money, route pick Lahore|Multan|Faisalabad = Lahore
setting price money = 1500 "Standard fare"
setting target money = 40000 "Daily takings target"
state r pick Lahore|Multan|Faisalabad = Lahore
let sold = count(ticket today where route = r)
topbar ticket, "Sell ticket"
choice r
statcard sold, "of 40 seats sold today for this route", 40
section "Seat map", "tap a free seat to sell it at the standard fare"
  grid 8 gap 1
    each 1..40 as n
      if count(ticket today where route = r and seat = n) = 0
        box height 34 radius 6 fill soft tap add ticket seat = n, name = "Walk-in", fare = price, route = r
          n small align center
      else
        box height 34 radius 6 fill accent
          n small align center color bg
row gap 2
  stat sum(ticket.fare today), "takings today"
  stat count(ticket today), "passengers today"
  stat 40 - sold, "seats still free"
goal sum(ticket.fare today), target, "of the daily takings target"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(ticket.fare on it), target
section "Passengers per route", "this week"
  share ticket week by route, count(it), it.key
section "Takings per route", "this month"
  bars ticket month by route, sum(it.fare), it.key
section "Passengers today", plural(count(ticket today), "ticket")
  each ticket today sort seat as t empty "No tickets sold yet today. Tap a seat to sell the first one."
    row card gap 2 tap edit t swipe remo
```

Target program:
```
app "Bus Seats" bus ocean
table ticket seat num 1..40, name text, fare money, route pick Lahore|Multan|Faisalabad = Lahore
setting price money = 1500 "Standard fare"
setting target money = 40000 "Daily takings target"
state r pick Lahore|Multan|Faisalabad = Lahore
let sold = count(ticket today where route = r)
topbar ticket, "Sell ticket"
choice r
statcard sold, "of 40 seats sold today for this route", 40
section "Seat map", "tap a free seat to sell it at the standard fare"
  grid 8 gap 1
    each 1..40 as n
      if count(ticket today where route = r and seat = n) = 0
        box height 34 radius 6 fill soft tap add ticket seat = n, name = "Walk-in", fare = price, route = r
          n small align center
      else
        box height 34 radius 6 fill accent
          n small align center color bg
row gap 2
  stat sum(ticket.fare today), "takings today"
  stat count(ticket today), "passengers today"
  stat 40 - sold, "seats still free"
goal sum(ticket.fare today), target, "of the daily takings target"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(ticket.fare on it), target
section "Passengers per route", "this week"
  share ticket week by route, count(it), it.key
section "Takings per route", "this month"
  bars ticket month by route, sum(it.fare), it.key
section "Passengers today", plural(count(ticket today), "ticket")
  each ticket today sort seat as t empty "No tickets sold yet today. Tap a seat to sell the first one."
    row card gap 2 tap edit t swipe remove t
      "Seat" t.seat bold
      stack grow gap 0
        t.name bold
        t.route faint
      t.fare bold
section "Fare check", "this week"
  row gap 2
    stat sum(ticket.fare week), "takings"
    stat round(sum(ticket.fare week) / max(count(ticket week), 1)), "average fare"
section "Last 6 weeks"
  daygrid last 42 days, count(ticket on it), 3
if sum(ticket.fare today) >= target
  "Target reached for today." color good bold
```

## 2. create | v2:real:create | hurried

**Request:** hospital shifts, hours and nights this month

Target program:
```
app "Shifts" clock ocean
table shift ward text?, kind pick Day|Evening|Night = Day, hours num 1..24 = 8, note text?
sum(shift.hours month) "hours worked this month" big
stat count(shift month where kind = Night), "night shifts this month"
stat count(shift month), "shifts this month"
calendar shift
form shift, "Add shift"
list shift by day
```

## 3. edit | v2:real:edit | fuller

**Request:** Guard hours is what I am actually doing on these shifts, so could the app be renamed Guard hours? The pay per hour and the hours this week can stay the same.

Program before:
```
app "Night shifts" moon ink
table shift start time, end time
setting rate money = 350 "Pay per hour"
"Hours this week" sum(shift week, (it.end - it.start) / 1h) big
"Pay this week" sum(shift week, (it.end - it.start) / 1h) * rate faint
each shift sort at desc top 10 as s empty "No shifts yet"
  row card gap 2 tap edit s swipe remove s
    s.start "to" s.end grow
    (s.end - s.start) / 1h "h" bold
form shift, "Add shift"
```

Target program:
```
app "Guard hours" moon ink
table shift start time, end time
setting rate money = 350 "Pay per hour"
"Hours this week" sum(shift week, (it.end - it.start) / 1h) big
"Pay this week" sum(shift week, (it.end - it.start) / 1h) * rate faint
each shift sort at desc top 10 as s empty "No shifts yet"
  row card gap 2 tap edit s swipe remove s
    s.start "to" s.end grow
    (s.end - s.start) / 1h "h" bold
form shift, "Add shift"
```

## 4. edit | v3:change-mode-new-app | new_app_in_change_mode

**Request:** Could you build a pen pal tracker where I log each letter I send and receive, the friend's name, and the date?

Program before:
```
app "Time off" plane blue
table member name text
table off member ref member
state who ref member
state m date = today
topbar member, "Add person"
choice who
monthnav m
grid 7 gap 1
  each days month of m as d
    box height 32 radius 6 fill if(count(off on d where member = who) > 0, accent, soft) tap toggle off on d where member = who
      monthday(d) small align center
section "This month"
  each member sort name as p empty "Add your team above."
    row gap 2
      p.name grow
      count(p.off month of m) "days off" faint
      if count(p.off today) > 0
        "out today" bold color warn
```

Target program:
```
ask "New app or change Time off?" "New app" "Change Time off"
```

## 5. edit | v2:real:edit | hurried

**Request:** add a note box to grateful pls

Program before:
```
app "Grateful" heart plum
table thanks one text, two text, three text
remind "Three things you are grateful for tonight" at 21:00
form thanks, "Save tonight"
"Nights written" count(thanks) head
list thanks by day
```

Target program:
```
app "Grateful" heart plum
table thanks one text, two text, three text, note text?
remind "Three things you are grateful for tonight" at 21:00
form thanks, "Save tonight"
"Nights written" count(thanks) head
list thanks by day
```

## 6. edit | v3:long-edit:addchart | long_edit

**Request:** show a trend line over 30 days

Program before:
```
app "Wood Works" tool orange
table project client text, item pick Door|Bed|Cupboard|Table|Chair = Door, price money, advance money = 0, stage pick Quote|Cutting|Assembly|Polish|Delivered = Quote, due date
table material what text, cost money
setting slots num = 6 "Jobs the workshop can hold"
let open = count(project where stage != Delivered)
let balance = sum(project where stage != Delivered, it.price - it.advance)
topbar project, "New job"
goal open, slots, "jobs in the workshop", "jobs"
row gap 2
  stat balance, "to collect from clients"
  stat sum(material.cost month), "wood and fittings this month"
  stat sum(project.price month where stage = Delivered), "delivered this month"
scroll gap 1
  each options project.stage as s
    stack card gap 0 width 120
      s bold
      count(project where stage = s) big
      sum(project.price where stage = s) faint
section "Open jobs", "soonest due first"
  each project where stage != Delivered sort due as p empty "No open jobs. Quote the next customer."
    row card gap 2 tap edit p swipe remove p
      stack grow gap 0
        p.client p.item bold
        p.stage "- due" p.due faint color if(p.due < today, bad, muted)
      stack gap 0 align end
        p.price - p.advance bold
        "balance" tiny faint
section "Jobs by item", "all time"
  share project by item, count(it), it.key
section "Materials", "latest"
  list material top 4, "No materials bought yet."
  form material, "Add material"
section "Income per week", "last 4 weeks
```

Target program:
```
app "Wood Works" tool orange
table project client text, item pick Door|Bed|Cupboard|Table|Chair = Door, price money, advance money = 0, stage pick Quote|Cutting|Assembly|Polish|Delivered = Quote, due date
table material what text, cost money
setting slots num = 6 "Jobs the workshop can hold"
let open = count(project where stage != Delivered)
let balance = sum(project where stage != Delivered, it.price - it.advance)
topbar project, "New job"
goal open, slots, "jobs in the workshop", "jobs"
row gap 2
  stat balance, "to collect from clients"
  stat sum(material.cost month), "wood and fittings this month"
  stat sum(project.price month where stage = Delivered), "delivered this month"
scroll gap 1
  each options project.stage as s
    stack card gap 0 width 120
      s bold
      count(project where stage = s) big
      sum(project.price where stage = s) faint
section "Open jobs", "soonest due first"
  each project where stage != Delivered sort due as p empty "No open jobs. Quote the next customer."
    row card gap 2 tap edit p swipe remove p
      stack grow gap 0
        p.client p.item bold
        p.stage "- due" p.due faint color if(p.due < today, bad, muted)
      stack gap 0 align end
        p.price - p.advance bold
        "balance" tiny faint
section "Jobs by item", "all time"
  share project by item, count(it), it.key
section "Materials", "latest"
  list material top 4, "No materials bought yet."
  form material, "Add material"
section "Income per week", "last 4 weeks"
  bars days last 4 weeks, sum(project.price week of it where stage = Delivered), monthday(it)
section "Open jobs per item", "not delivered"
  each options project.item as v
    row gap 2
      v bold grow
      count(project where item = v and stage != Delivered) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(count(project where item = v and stage != Delivered) / max(open, 1), 0, 1), 4 fill accent radius 2
section "Trend"
  trend days last 30 days, sum(project.price on it)
if count(project where stage != Delivered and due < today) > 0
  "A job is past its due date. Call the client." color bad bold
```

## 7. create | v2:real:create | hurried

**Request:** savings by month calendar grid

Target program:
```
app "Saved by month" coin mint
table saving amount money
setting best money = 20000 "Great month"
grid 4 gap 1
  each days year
    if monthday(it) = 1
      stack radius 8 pad 1 gap 0 align center fill if(sum(saving.amount month of it) > 0, accent, soft) opacity if(sum(saving.amount month of it) > 0, clamp(sum(saving.amount month of it) / best, 0.25, 1), 1)
        dayname(it) tiny
        monthname(it) tiny
        sum(saving.amount month of it) bold small
form saving
```

## 8. edit | v3:long-edit:renamebutton | long_edit

**Request:** rename Sell ticket button to Save entry

Program before:
```
app "Bus Seats" bus ocean
table ticket seat num 1..40, name text, fare money, route pick Lahore|Multan|Faisalabad = Lahore
setting price money = 1500 "Standard fare"
setting target money = 40000 "Daily takings target"
state r pick Lahore|Multan|Faisalabad = Lahore
let sold = count(ticket today where route = r)
topbar ticket, "Sell ticket"
choice r
statcard sold, "of 40 seats sold today for this route", 40
section "Seat map", "tap a free seat to sell it at the standard fare"
  grid 8 gap 1
    each 1..40 as n
      if count(ticket today where route = r and seat = n) = 0
        box height 34 radius 6 fill soft tap add ticket seat = n, name = "Walk-in", fare = price, route = r
          n small align center
      else
        box height 34 radius 6 fill accent
          n small align center color bg
row gap 2
  stat sum(ticket.fare today), "takings today"
  stat count(ticket today), "passengers today"
  stat 40 - sold, "seats still free"
goal sum(ticket.fare today), target, "of the daily takings target"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(ticket.fare on it), target
section "Passengers per route", "this week"
  share ticket week by route, count(it), it.key
section "Takings per route", "this month"
  bars ticket month by route, sum(it.fare), it.key
section "Passengers today", plural(count(ticket today), "ticket")
  each ticket today sort seat as t empty "No tickets sold yet today. Tap a seat to sell the first one."
    row card gap 2 tap edit t swipe remo
```

Target program:
```
app "Bus Seats" bus ocean
table ticket seat num 1..40, name text, fare money, route pick Lahore|Multan|Faisalabad = Lahore
setting price money = 1500 "Standard fare"
setting target money = 40000 "Daily takings target"
state r pick Lahore|Multan|Faisalabad = Lahore
let sold = count(ticket today where route = r)
topbar ticket, "Save entry"
choice r
statcard sold, "of 40 seats sold today for this route", 40
section "Seat map", "tap a free seat to sell it at the standard fare"
  grid 8 gap 1
    each 1..40 as n
      if count(ticket today where route = r and seat = n) = 0
        box height 34 radius 6 fill soft tap add ticket seat = n, name = "Walk-in", fare = price, route = r
          n small align center
      else
        box height 34 radius 6 fill accent
          n small align center color bg
row gap 2
  stat sum(ticket.fare today), "takings today"
  stat count(ticket today), "passengers today"
  stat 40 - sold, "seats still free"
goal sum(ticket.fare today), target, "of the daily takings target"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(ticket.fare on it), target
section "Passengers per route", "this week"
  share ticket week by route, count(it), it.key
section "Takings per route", "this month"
  bars ticket month by route, sum(it.fare), it.key
section "Passengers today", plural(count(ticket today), "ticket")
  each ticket today sort seat as t empty "No tickets sold yet today. Tap a seat to sell the first one."
    row card gap 2 tap edit t swipe remove t
      "Seat" t.seat bold
      stack grow gap 0
        t.name bold
        t.route faint
      t.fare bold
section "Fare check", "this week"
  row gap 2
    stat sum(ticket.fare week), "takings"
    stat round(sum(ticket.fare week) / max(count(ticket week), 1)), "average fare"
if sum(ticket.fare today) >= target
  "Target reached for today." color good bold
```

## 9. create | v2:v1:hand-ask | ask

**Request:** make me an app

Target program:
```
ask "What should the app help you with?" "Tracking something daily" "Money" "A list of things to do" "Notes"
```

## 10. create | v2:v1:template:expenses | detailed

**Request:** A shopping tracker. It needs expenses with what it was for and the amount and a category, how much I can safely spend per day, a monthly budget of 20000 and how much is left, bars that show which category costs most, last month for comparison and categories: Clothes, Shoes, Gadgets, Beauty and Gifts.

Target program:
```
app "Shopping" bag ink
table purchase what text, amount money, category pick Clothes|Shoes|Gadgets|Beauty|Gifts
let spent = sum(purchase.amount month)
setting budget money = 20000 "Monthly budget"
"Safe to spend" round(max(budget - spent, 0) / (monthdays(today) - monthday(today) + 1)) "a day" faint
if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
"Last month" sum(purchase.amount prev month) faint
form purchase
share purchase month by category, sum(it.amount), it.key
list purchase month by day
```

## 11. create | v2:hand2 | typos

**Request:** we play footbal evry friday, ground costs 3000, split between whoever came, show what each player owes

Target program:
```
app "Friday football" ball mint
table player name text
table played player ref player
setting ground money = 3000 "Ground cost"
let n = count(played today)
"Each pays" round(ground / max(n, 1)) big
count(played week) "plays this week" faint
each player sort name as p
  row card tap toggle p.played today
    p.name bold grow
    if(count(p.played today) > 0, "in", "out") color if(count(p.played today) > 0, good, muted)
form player, "Add player"
```

## 12. edit | v3:long-edit:reorder | long_edit

**Request:** Could the places section go below the numbers section? The numbers are what I check first, so I want the place names to come after them.

Program before:
```
app "Photo walks" eye ink
table walkp place text, theme pick Street|Nature|People|Buildings|Light = Street, shots num 1..500 = 20 unit "shots", keepers num 0..100 = 3
setting challenge num = 100 "Keepers this year"
let kept = sum(walkp.keepers year)
topbar walkp, "Log a walk"
statcard kept, "keepers this year of" challenge, challenge
row gap 2
  statcard count(walkp month), "walks this month"
  statcard sum(walkp.shots month), "shots this month"
  statcard round(sum(walkp.keepers) * 100 / max(sum(walkp.shots), 1)), "% keeper rate"
section "Walks per week", "last 8 weeks"
  bars 1..8, count(walkp week of (today - 7 * (8 - it))), join("W", it)
section "Themes", "keepers by theme"
  share walkp by theme, sum(it.keepers), it.key
section "Places"
  share walkp sort keepers desc top 5, it.keepers, it.place
section "Best walk", "most keepers"
  each walkp sort keepers desc top 1 as w empty "No walks yet."
    row gap 2
      w.place bold grow
      w.keepers "keepers" faint
section "Walk days", "last 10 weeks"
  heat last 70 days, count(walkp on it), 1
section "Since the last walk"
  since(walkp) big
  "days ago" faint
section "All walks"
  list walkp by day, "No walks yet. Take the camera for twenty minutes around your street."
row gap 2
  statcard count(walkp week), "entries this week"
  statcard count(walkp prev week), "entries last week"
section "Totals", "all time"
  count(walkp) "entries so far" big
  "This year" count(walkp year) faint
  "Last one" since(walkp) "days ago" fai
```

Target program:
```
app "Photo walks" eye ink
table walkp place text, theme pick Street|Nature|People|Buildings|Light = Street, shots num 1..500 = 20 unit "shots", keepers num 0..100 = 3
setting challenge num = 100 "Keepers this year"
let kept = sum(walkp.keepers year)
topbar walkp, "Log a walk"
statcard kept, "keepers this year of" challenge, challenge
row gap 2
  statcard count(walkp month), "walks this month"
  statcard sum(walkp.shots month), "shots this month"
  statcard round(sum(walkp.keepers) * 100 / max(sum(walkp.shots), 1)), "% keeper rate"
section "Walks per week", "last 8 weeks"
  bars 1..8, count(walkp week of (today - 7 * (8 - it))), join("W", it)
section "Themes", "keepers by theme"
  share walkp by theme, sum(it.keepers), it.key
section "Best walk", "most keepers"
  each walkp sort keepers desc top 1 as w empty "No walks yet."
    row gap 2
      w.place bold grow
      w.keepers "keepers" faint
section "Walk days", "last 10 weeks"
  heat last 70 days, count(walkp on it), 1
section "Since the last walk"
  since(walkp) big
  "days ago" faint
section "All walks"
  list walkp by day, "No walks yet. Take the camera for twenty minutes around your street."
row gap 2
  statcard count(walkp week), "entries this week"
  statcard count(walkp prev week), "entries last week"
section "Totals", "all time"
  count(walkp) "entries so far" big
  "This year" count(walkp year) faint
  "Last one" since(walkp) "days ago" faint
section "Which weekdays", "all time"
  bars ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], count(walkp where dayname(at) = it), it
section "Busy days", "last 5 weeks"
  daygrid last 35 days, count(walkp on it), 2
section "The numbers", "all time"
  "Average" round(avg(walkp.shots) * 10) / 10 "shots" big
  "Highest" max(walkp.shots) "shots" faint
  "Lowest" min(walkp.shots) "shots" faint
section "Places"
  share walkp sort keepers desc top 5, it.keepers, it.place
```

## 13. edit | v3:long-edit:addchart | long_edit

**Request:** habit grid for the last 6 weeks

Program before:
```
app "Orders Pro" package plum
table order customer text, fabric pick Red|Blue|Green|Yellow|Black|Grey = Blue, chest num 0.., waist num 0.., length num 0.., due date, done bool
each order where done = no sort due as o
  stack card gap 1
    row gap 1
      box width 4 height 4 radius 6 fill if(o.fabric = Red, bad, if(o.fabric = Blue, accent, if(o.fabric = Green, good, if(o.fabric = Yellow, warn, if(o.fabric = Black, ink, muted)))))
      o.customer bold grow
      "Due" o.due fill bad color bg small radius 6 pad 1
    row gap 1
      stack radius 6 pad 1 fill soft grow
        "Chest" tiny faint
        o.chest bold
      stack radius 6 pad 1 fill soft grow
        "Waist" tiny faint
        o.waist bold
      stack radius 6 pad 1 fill soft grow
        "Length" tiny faint
        o.length bold
    row gap 1
      o.fabric faint grow
      toggle o.done
form order, "New order"
```

Target program:
```
app "Orders Pro" package plum
table order customer text, fabric pick Red|Blue|Green|Yellow|Black|Grey = Blue, chest num 0.., waist num 0.., length num 0.., due date, done bool
each order where done = no sort due as o
  stack card gap 1
    row gap 1
      box width 4 height 4 radius 6 fill if(o.fabric = Red, bad, if(o.fabric = Blue, accent, if(o.fabric = Green, good, if(o.fabric = Yellow, warn, if(o.fabric = Black, ink, muted)))))
      o.customer bold grow
      "Due" o.due fill bad color bg small radius 6 pad 1
    row gap 1
      stack radius 6 pad 1 fill soft grow
        "Chest" tiny faint
        o.chest bold
      stack radius 6 pad 1 fill soft grow
        "Waist" tiny faint
        o.waist bold
      stack radius 6 pad 1 fill soft grow
        "Length" tiny faint
        o.length bold
    row gap 1
      o.fabric faint grow
      toggle o.done
section "Last 6 weeks"
  daygrid last 42 days, count(order on it), 3
form order, "New order"
```

## 14. create | v2:real:create | hurried

**Request:** wedding spending per month list

Target program:
```
app "Wedding" gift ink
table wed_cost what text, amount money
state m date = today
let spent = sum(wed_cost.amount month of m)
monthnav m
"Spent" spent big
form wed_cost
list wed_cost month of m by day
```

## 15. edit | v2:real:edit | hurried

**Request:** can the calorie log take a little note on each bite

Program before:
```
app "Calories" food slate
table bite kcal num 10..3000 unit "kcal"
form bite
daybars last 7 days, sum(bite.kcal on it)
list bite by day
remind "Time to log calories" every 2h from 9:00 to 21:00
```

Target program:
```
app "Calories" food slate
table bite kcal num 10..3000 unit "kcal", note text?
form bite
daybars last 7 days, sum(bite.kcal on it)
list bite by day
remind "Time to log calories" every 2h from 9:00 to 21:00
```

## 16. edit | v2:hand2-edit | plain

**Request:** i also pay for things for clients, add expenses per project and include them in the invoice amount

Program before:
```
app "Timesheet" clock slate
table project client text, name text, rate money
table entry project ref project, hrs num 0.25..16, billable bool
each project as p
  let billed = sum(p.entry.hrs where billable = yes)
  stack card gap 1
    row
      p.name bold grow
      p.client faint
    "Hours this week" sum(p.entry.hrs week) faint
    "To invoice" billed * p.rate big
form project, "Add project"
form entry, "Log hours"
```

Target program:
```
app "Timesheet" clock slate
table project client text, name text, rate money
table entry project ref project, hrs num 0.25..16, billable bool
table expense project ref project, what text, cost money
each project as p
  let billed = sum(p.entry.hrs where billable = yes)
  stack card gap 1
    row
      p.name bold grow
      p.client faint
    "Hours this week" sum(p.entry.hrs week) faint
    "To invoice" billed * p.rate + sum(p.expense.cost) big
form project, "Add project"
form entry, "Log hours"
form expense, "Add expense"
```

## 17. edit | v3:long-edit:addfield | long_edit

**Request:** add a rating to each night

Program before:
```
app "Game nights" dice red
table night title text, winner pick Abbu|Ammi|Ali|Sara|Guest = Ali, points num 0..1000 = 50, players num 2..8 = 4
setting yearly_goal num = 24 "Game nights per year"
topbar night, "Add night"
statcard count(night year), "game nights this year, goal" yearly_goal, yearly_goal
section "Scoreboard", "wins this year"
  each options night.winner as w
    stack gap 0
      row
        w grow
        count(night year where winner = w) "wins" bold
      draw 100, 4
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * count(night year where winner = w) / max(count(night year), 1), 4 fill accent radius 2
section "Winning points", "average per player"
  share night year by winner, round(avg(it.points)), it.key
section "Favourite games"
  share night by title, count(it), it.key
section "Nights per month", "last 6 months"
  bars 1..6, count(night month of addmonths(today, it - 6)), monthname(addmonths(today, it - 6))
row gap 2
  statcard max(night.points), "highest winning score"
  statcard round(avg(night.players) * 10) / 10, "players on average"
section "Last night"
  each night top 1 as n empty "No game nights yet."
    row gap 2
      n.title bold grow
      n.winner "won with" n.points faint
section "Family streak"
  count(days last 30 days, count(night on it) > 0) "game nights in 30 days" big
section "All nights"
  list night by day, "No game nights yet. Add your next Monopoly or Ludo night."
row gap 2
  statcard count(night week), "entries
```

Target program:
```
app "Game nights" dice red
table night title text, winner pick Abbu|Ammi|Ali|Sara|Guest = Ali, points num 0..1000 = 50, players num 2..8 = 4, rating num? 1..5
setting yearly_goal num = 24 "Game nights per year"
topbar night, "Add night"
statcard count(night year), "game nights this year, goal" yearly_goal, yearly_goal
section "Scoreboard", "wins this year"
  each options night.winner as w
    stack gap 0
      row
        w grow
        count(night year where winner = w) "wins" bold
      draw 100, 4
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * count(night year where winner = w) / max(count(night year), 1), 4 fill accent radius 2
section "Winning points", "average per player"
  share night year by winner, round(avg(it.points)), it.key
section "Favourite games"
  share night by title, count(it), it.key
section "Nights per month", "last 6 months"
  bars 1..6, count(night month of addmonths(today, it - 6)), monthname(addmonths(today, it - 6))
row gap 2
  statcard max(night.points), "highest winning score"
  statcard round(avg(night.players) * 10) / 10, "players on average"
section "Last night"
  each night top 1 as n empty "No game nights yet."
    row gap 2
      n.title bold grow
      n.winner "won with" n.points faint
section "Family streak"
  count(days last 30 days, count(night on it) > 0) "game nights in 30 days" big
section "All nights"
  list night by day, "No game nights yet. Add your next Monopoly or Ludo night."
row gap 2
  statcard count(night week), "entries this week"
  statcard count(night prev week), "entries last week"
section "Totals", "all time"
  count(night) "entries so far" big
  "This year" count(night year) faint
  "Last one" since(night) "days ago" faint
section "Which weekdays", "all time"
  bars ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], count(night where dayname(at) = it), it
section "Busy days", "last 5 weeks"
  daygrid last 35 days, count(night on it), 2
```

## 18. edit | v3:long-edit:remove | long_edit

**Request:** drop the Topics lately section

Program before:
```
app "Study hours" book slate
table study subject pick Maths|Physics|Chemistry|English|Urdu = Maths, mins num 5..480 unit "min", topic text?
setting weekly_hours num = 15 "Study hours per week"
let hours = sum(study.mins week) / 60
topbar study, "Log study"
statcard round(hours * 10) / 10, "hours this week, goal" weekly_hours, weekly_hours
quick study, mins, [30, 45, 60]
section "Minutes per day", "last 7 days"
  goalbars last 7 days, sum(study.mins on it), weekly_hours * 60 / 7
section "By subject", "this month"
  share study month by subject, sum(it.mins), it.key
section "Study days", "last 10 weeks"
  heat last 70 days, count(study on it), 3
row gap 2
  statcard streak(study), "day streak"
  statcard round(sum(study.mins month) / 60), "hours this month"
section "Weak spots", "least studied this month"
  each options study.subject as s
    row gap 1
      s grow
      round(sum(study.mins month where subject = s) / 60 * 10) / 10 "h" bold
section "Topics lately"
  each study where topic != "" top 5 as t empty "Add a topic when you log study so you can see what you covered."
    row gap 2
      t.topic grow
      t.mins "min" faint
section "Study log"
  list study by day, "No study logged. Tap 30 after your first block."
row gap 2
  statcard count(study week), "entries this week"
  statcard count(study prev week), "entries last week"
section "Totals", "all time"
  count(study) "entries so far" big
  "This year" count(study year) faint
  "Last one" since(study) "days ago" faint
```

Target program:
```
app "Study hours" book slate
table study subject pick Maths|Physics|Chemistry|English|Urdu = Maths, mins num 5..480 unit "min", topic text?
setting weekly_hours num = 15 "Study hours per week"
let hours = sum(study.mins week) / 60
topbar study, "Log study"
statcard round(hours * 10) / 10, "hours this week, goal" weekly_hours, weekly_hours
quick study, mins, [30, 45, 60]
section "Minutes per day", "last 7 days"
  goalbars last 7 days, sum(study.mins on it), weekly_hours * 60 / 7
section "By subject", "this month"
  share study month by subject, sum(it.mins), it.key
section "Study days", "last 10 weeks"
  heat last 70 days, count(study on it), 3
row gap 2
  statcard streak(study), "day streak"
  statcard round(sum(study.mins month) / 60), "hours this month"
section "Weak spots", "least studied this month"
  each options study.subject as s
    row gap 1
      s grow
      round(sum(study.mins month where subject = s) / 60 * 10) / 10 "h" bold
section "Study log"
  list study by day, "No study logged. Tap 30 after your first block."
row gap 2
  statcard count(study week), "entries this week"
  statcard count(study prev week), "entries last week"
section "Totals", "all time"
  count(study) "entries so far" big
  "This year" count(study year) faint
  "Last one" since(study) "days ago" faint
section "Which weekdays", "all time"
  bars ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], count(study where dayname(at) = it), it
section "Busy days", "last 5 weeks"
  daygrid last 35 days, count(study on it), 2
section "The numbers", "all time"
  "Average" round(avg(study.mins) * 10) / 10 "min" big
  "Highest" max(study.mins) "min" faint
  "Lowest" min(study.mins) "min" faint
```

## 19. edit | v3:long-edit:reorder | long_edit

**Request:** this month goes below entries

Program before:
```
app "Steps" walk mint
table steps count num 100..60000 unit "steps", walk text?
setting goal num = 8000 "Daily steps goal"
let today_steps = sum(steps.count today)
let days_hit = count(days last 30 days, sum(steps.count on it) >= goal)
topbar steps, "Add steps"
statcard today_steps, "steps today, goal" goal, goal
quick steps, count, [1000, 2000, 5000]
section "Last 7 days", "goal line" goal
  goalbars last 7 days, sum(steps.count on it), goal
section "This month", "days on goal:" days_hit
  daygrid last 28 days, sum(steps.count on it), goal
row gap 2
  stat round(sum(steps.count last 7 days) / 7), "average a day, 7 days"
  stat max(days last 30 days, sum(steps.count on it)), "best day in 30 days"
  stat round(sum(steps.count today) * 0.0008 * 10) / 10, "km walked today"
section "Goal streak"
  count(days last 7 days, sum(steps.count on it) >= goal) "of the last 7 days on goal" big
  "Weekly total" sum(steps.count week) faint
section "Entries"
  list steps by day, "No steps logged. Tap 1000 after a short walk."
section "Weekly steps"
  sum(steps.count week) big
  "steps this week, last week" sum(steps.count prev week) faint
section "Walks named"
  share steps month by walk, sum(it.count), it.key
section "Calories rough guide"
  round(sum(steps.count today) * 0.04) "kcal burned today, roughly" faint
row gap 2
  statcard count(steps week), "entries this week"
  statcard count(steps prev week), "entries last week"
section "Totals", "all time"
  count(steps) "entries so far" big
 
```

Target program:
```
app "Steps" walk mint
table steps count num 100..60000 unit "steps", walk text?
setting goal num = 8000 "Daily steps goal"
let today_steps = sum(steps.count today)
let days_hit = count(days last 30 days, sum(steps.count on it) >= goal)
topbar steps, "Add steps"
statcard today_steps, "steps today, goal" goal, goal
quick steps, count, [1000, 2000, 5000]
section "Last 7 days", "goal line" goal
  goalbars last 7 days, sum(steps.count on it), goal
row gap 2
  stat round(sum(steps.count last 7 days) / 7), "average a day, 7 days"
  stat max(days last 30 days, sum(steps.count on it)), "best day in 30 days"
  stat round(sum(steps.count today) * 0.0008 * 10) / 10, "km walked today"
section "Goal streak"
  count(days last 7 days, sum(steps.count on it) >= goal) "of the last 7 days on goal" big
  "Weekly total" sum(steps.count week) faint
section "Entries"
  list steps by day, "No steps logged. Tap 1000 after a short walk."
section "This month", "days on goal:" days_hit
  daygrid last 28 days, sum(steps.count on it), goal
section "Weekly steps"
  sum(steps.count week) big
  "steps this week, last week" sum(steps.count prev week) faint
section "Walks named"
  share steps month by walk, sum(it.count), it.key
section "Calories rough guide"
  round(sum(steps.count today) * 0.04) "kcal burned today, roughly" faint
row gap 2
  statcard count(steps week), "entries this week"
  statcard count(steps prev week), "entries last week"
section "Totals", "all time"
  count(steps) "entries so far" big
  "This year" count(steps year) faint
  "Last one" since(steps) "days ago" faint
section "Which weekdays", "all time"
  bars ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], count(steps where dayname(at) = it), it
section "Busy days", "last 5 weeks"
  daygrid last 35 days, count(steps on it), 2
section "The numbers", "all time"
  "Average" round(avg(steps.count) * 10) / 10 "steps" big
  "Highest" max(steps.count) "steps" faint
  "Lowest" min(steps.count) "steps" faint
```

## 20. create | hand3:c6 | short

**Request:** pay split

Target program:
```
app "Pay Split" wallet slate
state income money = 85000
state needs num = 50
state wants num = 30
let save = max(100 - needs - wants, 0)
field income "Monthly income"
"Needs" needs "%" faint
slider needs 0..100
"Wants" wants "%" faint
slider wants 0..100
row gap 2
  statcard round(income * needs / 100), "needs"
  statcard round(income * wants / 100), "wants"
  statcard round(income * save / 100), "savings"
bars [1, 2, 3], if(it = 1, needs, if(it = 2, wants, save)), if(it = 1, "Needs", if(it = 2, "Wants", "Savings"))
if needs + wants > 100
  "Needs and wants add up to more than 100%." color bad
```

## 21. create | v2:v1:hand | custom_ui

**Request:** treasure hunt for kids, clues are stored in a list, a big button reveals the next clue one at a time and a row of footprints shows progress

Target program:
```
app "Treasure hunt" map plum
table clue text text
state step num = 1
let n = count(clue)
each clue sort at as c
  if index = step - 1
    stack card gap 1
      "Clue" step "of" n faint
      c.text head
row gap 1
  each 1..n
    icon if(it <= step, "star", "minus")
button "Found it, next clue" tap set step = min(step + 1, n)
button "Start again" tap set step = 1
form clue, "Add clue"
```

## 22. create | v2:v1:template:quantity | multi_feature

**Request:** A drawing log: a heat grid so I can see good and bad days, a day streak counter, two tabs: today and history, a weekly total and one-tap buttons: 15, 30, 60

Target program:
```
app "Drawing" pencil mint
table sketch mins num 5..300 unit "min"
screen main "Today" home
  stat streak(sketch), "day streak"
  stat sum(sketch.mins week), "this week"
  quick sketch, mins, [15, 30, 60]
  form sketch
screen past "History" chart
  heat last 70 days, sum(sketch.mins on it), 30
  list sketch
```

## 23. edit | v3:long-edit:addchart | long_edit

**Request:** Add a habit grid for the last 6 weeks as a new section, a grid lets me see which weeks sold well and which were slow at a glance.

Program before:
```
app "Gym Pro" dumbbell slate
table member name text, fee money, due date, ends date
table checkin member ref member
table trainer who text, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, start time
"Check-ins today" count(checkin today) big
"Fees due" head
each member where due <= today sort due
  row card
    it.name grow
    it.fee bold color bad
"Memberships ending in 14 days" head
each member where ends - today <= 14 and ends >= today sort ends
  row card
    it.name grow
    it.ends color warn
"Members" head
each member sort name
  row card
    it.name grow
    button "Check in" tap add checkin member = it
    button "Paid" tap set it.due = addmonths(it.due, 1)
"Trainer schedule" head
each trainer sort start
  row card tap edit it
    it.day it.start it.who
form member, "Add member"
form trainer, "Add trainer slot"
```

Target program:
```
app "Gym Pro" dumbbell slate
table member name text, fee money, due date, ends date
table checkin member ref member
table trainer who text, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, start time
"Check-ins today" count(checkin today) big
"Fees due" head
each member where due <= today sort due
  row card
    it.name grow
    it.fee bold color bad
"Memberships ending in 14 days" head
each member where ends - today <= 14 and ends >= today sort ends
  row card
    it.name grow
    it.ends color warn
"Members" head
each member sort name
  row card
    it.name grow
    button "Check in" tap add checkin member = it
    button "Paid" tap set it.due = addmonths(it.due, 1)
"Trainer schedule" head
each trainer sort start
  row card tap edit it
    it.day it.start it.who
form member, "Add member"
section "Last 6 weeks"
  daygrid last 42 days, count(member on it), 3
form trainer, "Add trainer slot"
```

## 24. edit | v3:long-edit:remove | long_edit

**Request:** remove hours per field

Program before:
```
app "Pump Log" drop ocean
table irrigate field pick Cotton|Wheat|Orchard|Fodder = Cotton, hours num 1..24 = 4 unit "h"
table diesel litres num 1..200 = 20 unit "L", cost money
setting budget num = 60 "Pump hours per week"
let used = sum(irrigate.hours week)
topbar irrigate, "Log pumping"
goal used, budget, "pump hours this week", "h"
row gap 2
  stat sum(irrigate.hours today), "hours today"
  stat sum(diesel.litres month), "litres of diesel"
  stat round(sum(diesel.cost month) / max(sum(irrigate.hours month), 1)), "diesel cost per hour"
section "Hours per field", "this week"
  share irrigate week by field, sum(it.hours), it.key
section "Hours per day", "last 14 days"
  goalbars last 14 days, sum(irrigate.hours on it), budget / 7
section "Watered days", "last 5 weeks"
  heat last 35 days, count(irrigate on it)
section "Fields not watered this week"
  each options irrigate.field as f
    if count(irrigate week where field = f) = 0
      row gap 2
        f bold grow
        "Thirsty" color warn
section "Diesel", "this month"
  stat sum(diesel.cost month), "spent"
  form diesel, "Add diesel"
list irrigate today, "No pumping logged today."
section "Hours per field", "this week"
  each options irrigate.field as v
    row gap 2
      v bold grow
      sum(irrigate.hours week where field = v) "h" faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(irrigate.hours week where field = v) / max(budget / 2, 1), 0, 1), 4 fill acc
```

Target program:
```
app "Pump Log" drop ocean
table irrigate field pick Cotton|Wheat|Orchard|Fodder = Cotton, hours num 1..24 = 4 unit "h"
table diesel litres num 1..200 = 20 unit "L", cost money
setting budget num = 60 "Pump hours per week"
let used = sum(irrigate.hours week)
topbar irrigate, "Log pumping"
goal used, budget, "pump hours this week", "h"
row gap 2
  stat sum(irrigate.hours today), "hours today"
  stat sum(diesel.litres month), "litres of diesel"
  stat round(sum(diesel.cost month) / max(sum(irrigate.hours month), 1)), "diesel cost per hour"
section "Hours per day", "last 14 days"
  goalbars last 14 days, sum(irrigate.hours on it), budget / 7
section "Watered days", "last 5 weeks"
  heat last 35 days, count(irrigate on it)
section "Fields not watered this week"
  each options irrigate.field as f
    if count(irrigate week where field = f) = 0
      row gap 2
        f bold grow
        "Thirsty" color warn
section "Diesel", "this month"
  stat sum(diesel.cost month), "spent"
  form diesel, "Add diesel"
list irrigate today, "No pumping logged today."
section "Hours per field", "this week"
  each options irrigate.field as v
    row gap 2
      v bold grow
      sum(irrigate.hours week where field = v) "h" faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(irrigate.hours week where field = v) / max(budget / 2, 1), 0, 1), 4 fill accent radius 2
section "Latest entries", "tap one to edit it"
  each irrigate top 3 as x empty "Nothing here yet."
    row card gap 2 tap edit x swipe remove x
      stack grow gap 0
        x.field bold
        x.at faint
      x.hours "h" bold
```

## 25. edit | v2:real:edit | hurried

**Request:** stairs goal today

Program before:
```
app "Stairs" run plum
table climb floors num 1..100 unit "floors"
form climb
list climb by day
```

Target program:
```
app "Stairs" run plum
table climb floors num 1..100 unit "floors"
setting goal num = 30 "Daily goal (floors)"
goal sum(climb.floors today), goal, "today", "floors"
form climb
list climb by day
```

## 26. create | v2:v1:hand | short

**Request:** cab driver trips and fuel

Target program:
```
app "Cab log" car slate
table ride km num 1..500, fare money, pay pick Cash|Card|App = Cash
table fill litres num 1..80, cost money
"Today" sum(ride.fare today) big
sum(ride.km today) "km" "|" count(ride today) "rides" faint
"Cash in hand" sum(ride.fare today where pay = Cash) faint
form ride, "Add ride"
form fill, "Fuel fill"
list ride today
```

## 27. create | v2:real:create | hurried

**Request:** gym sets reps and kg each day, pls

Target program:
```
app "Daily Gym log" dumbbell ink
table sets exercise text, sets num 1..20 = 3, reps num 1.., kg num 0.. = 0
count(sets today) "exercises today" head
form sets
list sets by day
```

## 28. create | v2:v1:template:mixedlog | vague

**Request:** I sleep badly. an app for it?

Target program:
```
app "Sleep" bed mint
table night hours num 0..16, quality num 1..5
stat last(night.hours), "latest"
form night
trend night last 90 days sort at, it.hours
list night
```

## 29. create | v2:real:create | hurried

**Request:** seating chart for 20 seats

Target program:
```
app "Seating" seat slate
table desk nr num 1..20, name text
grid 5 gap 1
  each 1..20 as n
    box height 54 radius 8 fill if(count(desk where nr = n) > 0, accent, soft) tap edit last(desk where nr = n)
      n tiny
      last(desk.name where nr = n) small bold
form desk, "Seat a student"
"Seated" count(desk) "of 20" faint
```

## 30. create | v2:real:oos | hurried

**Request:** plant water count, share it with mum

Target program:
```
app "Plant water" plant ink
table water ml num 10..2000 unit "ml"
setting goal num = 3500 "Weekly goal (ml)"
goal sum(water.ml week), goal, "this week", "ml"
form water
daybars last 7 days, sum(water.ml on it)
list water
remind "Time to log watering my plants" at 8:00, 20:00
```

## 31. edit | v2:real:edit | hurried

**Request:** scrabble theme slate

Program before:
```
app "Scrabble" board ink
table point team pick Amina|Bilal, pts num 1..500 = 1
let a = sum(point.pts where team = Amina)
let b = sum(point.pts where team = Bilal)
row gap 2
  stack card grow align center
    "Amina" bold
    a big
    button "+1" tap add point team = Amina, pts = 1
    row gap 1
      button "+2" tap add point team = Amina, pts = 2
  stack card grow align center
    "Bilal" bold
    b big
    button "+1" tap add point team = Bilal, pts = 1
    row gap 1
      button "+2" tap add point team = Bilal, pts = 2
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
list point
```

Target program:
```
app "Scrabble" board slate
table point team pick Amina|Bilal, pts num 1..500 = 1
let a = sum(point.pts where team = Amina)
let b = sum(point.pts where team = Bilal)
row gap 2
  stack card grow align center
    "Amina" bold
    a big
    button "+1" tap add point team = Amina, pts = 1
    row gap 1
      button "+2" tap add point team = Amina, pts = 2
  stack card grow align center
    "Bilal" bold
    b big
    button "+1" tap add point team = Bilal, pts = 1
    row gap 1
      button "+2" tap add point team = Bilal, pts = 2
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
list point
```

## 32. create | v2:real:create | fuller

**Request:** I keep revising what I already know, so I want the five weakest topics at the top with their subject, hours and confidence, then all topics sorted by confidence, and a box to add a new topic.

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

## 33. create | v2:v1:template:quantity | detailed

**Request:** An app to track my bike rides. I want two tabs: today and history, the total for this week and a line graph of the last two weeks.

Target program:
```
app "Cycling" bike ink
table ride km num 0.5..200 unit "km"
screen main "Today" home
  stat sum(ride.km week), "this week"
  form ride
screen past "History" chart
  trend days last 14 days, sum(ride.km on it)
  list ride
```

## 34. create | v2:v1:hand | short

**Request:** zakat on my savings

Target program:
```
app "Zakat" mosque mint
setting nisab money = 400000 "Nisab value"
state cash money = 0
state gold money = 0
state owed money = 0
field cash "Cash and bank"
field gold "Gold value"
field owed "Loans to pay"
let net = cash + gold - owed
if net >= nisab
  "Zakat due" round(net * 0.025) big
else
  "Below nisab, nothing due" head
"Net savings" net faint
```

## 35. edit | v2:v1:hand-edit | plain

**Request:** we get 24 days now

Program before:
```
app "Leave" plane ocean
table leave kind pick Casual|Sick|Annual = Annual, days num 1..30 = 1
setting allowed num = 20 "Days allowed per type"
each options leave.kind as k
  let used = sum(leave.days year where kind = k)
  stack gap 1
    row
      k bold grow
      used "of" allowed "days" faint
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * clamp(used / allowed, 0, 1), 4 fill if(used >= allowed, bad, accent) radius 2
form leave, "Take leave"
list leave by day
```

Target program:
```
app "Leave" plane ocean
table leave kind pick Casual|Sick|Annual = Annual, days num 1..30 = 1
setting allowed num = 24 "Days allowed per type"
each options leave.kind as k
  let used = sum(leave.days year where kind = k)
  stack gap 1
    row
      k bold grow
      used "of" allowed "days" faint
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * clamp(used / allowed, 0, 1), 4 fill if(used >= allowed, bad, accent) radius 2
form leave, "Take leave"
list leave by day
```

## 36. create | hand3:c5 | short

**Request:** buy 3 get 1 free

Target program:
```
app "Buy Get Free" gift blue
state price money = 0
state paid num = 3
state free num = 1
state want num = 8
let sets = if(paid + free > 0, floor(want / (paid + free)), 0)
let rest = want - sets * (paid + free)
let pay = sets * paid + min(rest, paid)
field price "Price of one"
"Buy" paid "get" free "free" faint
slider paid 1..10
slider free 1..5
field want "I need pieces"
statcard round(pay * price), "total to pay"
"Real price per piece" round(pay * price * 100 / max(want, 1)) / 100 faint
"That is" round(100 - pay * 100 / max(want, 1)) "% off" bold
```

## 37. edit | v3:long-edit:addchart | long_edit

**Request:** I would like a habit grid for the last 6 weeks, since a grid makes missed days easy to spot. Could you add it as a new section?

Program before:
```
app "Sprint" target mint
table task title text, points num 1..13 = 3, owner pick Ali|Sara|Bilal|Hina = Ali, stage pick Todo|Doing|Review|Done = Todo
setting commit num = 40 "Points committed"
let done_pts = sum(task.points where stage = Done)
topbar task, "Add task"
goal done_pts, commit, "points done this sprint", "pts"
grid 2 gap 1
  each options task.stage as s
    stack card gap 1
      row
        s head grow
        sum(task.points where stage = s) "pts" faint
      each task where stage = s as t empty "Empty"
        stack radius 8 pad 1 fill soft gap 0 tap edit t swipe remove t
          t.title bold
          t.owner "-" t.points "pts" faint
section "Points done per person"
  bars task where stage = Done by owner, sum(it.points), it.key
section "Load per person", "all open work"
  share task where stage != Done by owner, sum(it.points), it.key
section "Tasks added", "last 14 days"
  daybars last 14 days, count(task on it)
section "Waiting for review", "stuck in the review column"
  each task where stage = Review as t empty "Nothing waiting for review."
    row gap 2
      t.title bold grow
      t.owner faint
      button "Merge" tap set t.stage = Done
section "Points left", "to hit the commitment"
  row gap 2
    stat commit - done_pts, "pts to go"
    stat sum(task.points where stage = Doing), "pts in progress"
    stat count(task), "tasks in all"
if done_pts >= commit
  "Commitment met. Pull one more task." color good bold
section "Points per person", "committed"

```

Target program:
```
app "Sprint" target mint
table task title text, points num 1..13 = 3, owner pick Ali|Sara|Bilal|Hina = Ali, stage pick Todo|Doing|Review|Done = Todo
setting commit num = 40 "Points committed"
let done_pts = sum(task.points where stage = Done)
topbar task, "Add task"
goal done_pts, commit, "points done this sprint", "pts"
grid 2 gap 1
  each options task.stage as s
    stack card gap 1
      row
        s head grow
        sum(task.points where stage = s) "pts" faint
      each task where stage = s as t empty "Empty"
        stack radius 8 pad 1 fill soft gap 0 tap edit t swipe remove t
          t.title bold
          t.owner "-" t.points "pts" faint
section "Points done per person"
  bars task where stage = Done by owner, sum(it.points), it.key
section "Load per person", "all open work"
  share task where stage != Done by owner, sum(it.points), it.key
section "Tasks added", "last 14 days"
  daybars last 14 days, count(task on it)
section "Waiting for review", "stuck in the review column"
  each task where stage = Review as t empty "Nothing waiting for review."
    row gap 2
      t.title bold grow
      t.owner faint
      button "Merge" tap set t.stage = Done
section "Points left", "to hit the commitment"
  row gap 2
    stat commit - done_pts, "pts to go"
    stat sum(task.points where stage = Doing), "pts in progress"
    stat count(task), "tasks in all"
if done_pts >= commit
  "Commitment met. Pull one more task." color good bold
section "Last 6 weeks"
  daygrid last 42 days, count(task on it), 3
section "Points per person", "committed"
  each options task.owner as v
    row gap 2
      v bold grow
      sum(task.points where owner = v) "pts" faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(task.points where owner = v) / max(commit / 4, 1), 0, 1), 4 fill accent radius 2
```

## 38. create | v2:real:create | fuller

**Request:** A progress bar shows date nights this week against a weekly goal of 1, with a big count of today's date nights, a Log date button, and a 7 day bar chart.

Target program:
```
app "Date nights" heart ocean
table date
setting target num = 1 "Weekly goal"
stat count(date today), "today"
goal count(date week), target, "this week", "times"
button "Log date" tap add date
daybars last 7 days, count(date on it)
list date
```

## 39. create | hand3:r5 | detailed

**Request:** quit smoking on 1 november, used to smoke 15 a day and a pack of 20 costs 450. show me how many days smoke free, cigarettes not smoked, money saved so far, and let me log a craving or a slip with a note so I can see how many cravings I beat each week

Target program:
```
app "Smoke free" lock grey
table crave kind pick Craving_beaten|Slip = Craving_beaten, note text?
setting quit date = 2026-11-01 "Quit date"
setting perday num = 15 "Cigarettes per day before"
setting pack money = 450 "Price of a pack of 20"
let free = max(today - quit, 0)
topbar crave, "Log craving"
row gap 2
  statcard free, "days smoke free"
  statcard free * perday, "cigarettes not smoked"
statcard round(free * perday * pack / 20), "saved so far"
section "Cravings", "slips this month:" count(crave month where kind = Slip)
  goalbars last 7 days, count(crave on it where kind = Craving_beaten), 3
list crave top 10, "No cravings logged. When one hits, tap Log craving and beat it."
```

## 40. create | v2:real:create | fuller

**Request:** The header shows today's minutes against a 120 minute limit with a bar, then a seven day bar chart and bars comparing apps this week, plus a form to log time by app.

Target program:
```
app "My Phone time" phone slate
table session appname pick Instagram|YouTube|WhatsApp|Games|Other, mins num 1..600
setting limit num = 120 "Daily limit (minutes)"
goal sum(session.mins today), limit, "today", "min"
daybars last 7 days, sum(session.mins on it)
share session week by appname, sum(it.mins), it.key
form session, "Log time"
list session by day
"Blocking apps is not possible here; the app only tracks and warns." faint
```

