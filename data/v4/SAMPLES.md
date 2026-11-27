# Samples, 5 random new v4.1 rows per class


## add_option (100 rows)

### v4-e-1adead6299
Request: add speaker to the issues

Before:
```
app "Phone Fix" phone slate
table repair phone text, issue pick Screen|Battery|Charging_port|Software|Water = Screen, price money, status pick Waiting|Fixing|Ready|Collected = Waiting
setting target money = 8000 "Daily revenue target"
state tab pick Waiting|Fixing|Ready|Collected = Waiting
topbar repair, "New repair"
statcard sum(repair.price today where status = Collected), "collected today of" target, target
row gap 1
  each options repair.status as s
    button s count(repair where status = s) fill if(tab = s, accent, soft) grow tap set tab = s
each repair where status = tab sort at as r empty "No phones in this stage."
  row card gap 2 tap edit r swipe remove r
    stack grow gap 0
      r.phone bold
      r.issue "-" r.price faint
    if r.status = Waiting
      button "Start" tap set r.status = Fixing
    if r.status = Fixing
      button "Ready" tap set r.status = Ready
    if r.status = Ready
      button "Handed over" tap set r.status = Collected
section "Revenue", "last 7 days"
  goalbars last 7 days, sum(repair.price on it where status = Collected), target
section "Repairs by issue", "all time"
  share repair by issue, count(it), it.key
section "Waiting the longest", "oldest first"
  each repair where status = Waiting sort at top 3 as r empty "Nothing waiting."
    row gap 2
      r.phone bold grow
      r.issue faint
section "Work in the shop", "now"
  row gap 2
    stat count(repair where status = Fixing), "being fixed"
    stat count(repair where status = Ready)
```
Answer:
```
replace 2
+ table repair phone text, issue pick Screen|Battery|Charging_port|Software|Water|Speaker = Screen, price money, status pick Waiting|Fixing|Ready|Collected = Waiting
```

### v4-e-0035ac06ff
Request: add buckle to the items

Before:
```
app "Cobbler Bench" tool green dark
table repair item pick Sole|Stitching|Polish|Zip|Heel = Sole, owner text, price money, status pick Waiting|Ready|Collected = Waiting
topbar repair, "New repair"
row gap 2
  stat count(repair where status = Waiting), "on the bench"
  stat sum(repair.price where status = Ready), "waiting to be paid"
section "On the bench"
  each repair where status = Waiting sort at as r empty "The bench is clear."
    row gap 2 tap edit r swipe remove r
      stack grow gap 0
        r.owner bold
        r.item faint
      r.price bold
      button "Ready" tap set r.status = Ready
section "Ready for pickup"
  each repair where status = Ready sort at as r empty "Nothing ready right now."
    row gap 2 tap edit r
      r.owner bold grow
      r.price
      button "Collected" fill accent tap set r.status = Collected
section "Common repairs", "this month"
  share repair month by item, count(it), it.key
```
Answer:
```
replace 2
+ table repair item pick Sole|Stitching|Polish|Zip|Heel|Buckle = Sole, owner text, price money, status pick Waiting|Ready|Collected = Waiting
```

### v4-e-02ae826251
Request: add a Rest option

Before:
```
app "Gym Routine" dumbbell yellow
table move day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun = Mon, name text, sets num 1..10 = 3, reps num 1..50 = 10
table did move ref move
let todays = count(move where day = dayname(today))
topbar move, "Add exercise"
goal count(move, it.day = dayname(today) and count(it.did today) > 0), todays, "exercises done today"
"Sets planned today:" sum(move where day = dayname(today), it.sets) faint
each move where day = dayname(today) as m empty "Rest day. Add exercises for today to build the routine."
  row card gap 2 tap edit m swipe remove m
    toggle m.did
    stack grow gap 0
      m.name bold
      m.sets "x" m.reps faint
section "Your week", "exercises per day"
  grid 7 gap 1
    each options move.day as dd
      stack gap 0 align center
        dd tiny color if(dd = dayname(today), accent, muted)
        count(move where day = dd) bold
```
Answer:
```
replace 2
+ table move day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun|Rest = Mon, name text, sets num 1..10 = 3, reps num 1..50 = 10
```

### v4-e-f13ab1b8e8
Request: add brass to the scrap list, a guy brings it sometimes

Before:
```
app "Scrap Yard" tool teal
table buy item pick Iron|Copper|Paper|Plastic|Aluminium = Iron, kg num 1..2000 = 50 unit "kg", rate money
table sold item pick Iron|Copper|Paper|Plastic|Aluminium = Iron, kg num 1..5000 = 100 unit "kg", rate money
setting capacity num = 3000 "Yard capacity (kg)"
let stock = sum(buy.kg) - sum(sold.kg)
let margin = sum(sold, it.kg * it.rate) - sum(buy, it.kg * it.rate)
topbar buy, "Log purchase"
goal stock, capacity, "kg in the yard", "kg"
row gap 2
  stat sum(buy today, it.kg * it.rate), "bought today"
  stat sum(sold today, it.kg * it.rate), "sold today"
  stat margin, "margin so far"
section "Stock by metal", "bought minus sold"
  each options buy.item as m
    row gap 2
      m bold grow
      sum(buy.kg where item = m) - sum(sold.kg where item = m) "kg" faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp((sum(buy.kg where item = m) - sum(sold.kg where item = m)) / max(capacity / 3, 1), 0, 1), 4 fill accent radius 2
section "Kilos bought per day", "last 14 days"
  daybars last 14 days, sum(buy.kg on it)
section "Spend by metal", "this month"
  share buy month by item, sum(it, it.kg * it.rate), it.key
section "Sell scrap"
  form sold, "Save sale"
section "Latest sales"
  each sold top 4 as s empty "Nothing sold yet. Record the first load."
    row card gap 2 tap edit s swipe remove s
      stack grow gap 0
        s.item bold
        s.kg "kg at" s.rate faint
      s.kg * s.rate bold
section 
```
Answer:
```
replace 2
+ table buy item pick Iron|Copper|Paper|Plastic|Aluminium|Brass = Iron, kg num 1..2000 = 50 unit "kg", rate money
```

### v4-e-29d75f8920
Request: add testing to the kinds

Before:
```
app "Release prep" package blue
table todo name text, kind pick Code|Docs|Packaging|Announce = Code, done bool
setting ver text = "2.0.0" "Version"
setting due date = today "Release date"
topbar todo, "Add task"
join("v", ver) huge
due - today "days to go on" due faint
each options todo.kind as k
  stack card gap 1
    row gap 1
      k bold grow
      count(todo where kind = k and done = yes) "of" count(todo where kind = k) faint
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * count(todo where kind = k and done = yes) / max(count(todo where kind = k), 1), 4 fill accent radius 2
    each todo where kind = k sort done as t
      row gap 2 tap edit t swipe remove t
        toggle t.done
        t.name grow
```
Answer:
```
replace 2
+ table todo name text, kind pick Code|Docs|Packaging|Announce|Testing = Code, done bool
```


## remove_one (73 rows)

### v4-e-8091c7dfbf
Request: take away the quick buttons

Before:
```
app "Savings Thermometer" coin mint
table saved amount money
setting goal money = 50000
let total = sum(saved.amount all)
row gap 3 align center
  draw 40, 120 width 80
    rect 15, 5, 10, 90 stroke edge thick 1 radius 5
    rect 16, 95 - 88 * clamp(total / goal, 0, 1), 8, 88 * clamp(total / goal, 0, 1) fill accent radius 4
    circle 20, 105, 12 fill accent
  stack grow gap 1
    total big
    "of" goal faint
    round(100 * clamp(total / goal, 0, 1)) "% there" head
quick saved, amount, [500, 1000, 5000]
form saved, "Add savings"
list saved
```
Answer:
```
delete 14
```

### v4-e-18c79ae186
Request: remove the quick price buttons

Before:
```
app "Car Wash" car blue
table wash vehicle pick Bike|Car|Suv|Van = Car, price money = 500
table supply what text, cost money
setting target money = 10000 "Daily takings target"
"Car Wash" head
quick wash, price, [200, 500, 800, 1200]
statcard sum(wash.price today), "taken today of" target, target
row gap 2
  stat count(wash today), "washes today"
  stat sum(wash.price week), "this week"
  stat sum(wash.price month) - sum(supply.cost month), "left after supplies"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(wash.price on it), target
section "By vehicle", "this month"
  share wash month by vehicle, count(it), it.key
section "Busy days", "last 5 weeks"
  daygrid last 35 days, count(wash on it), 15
section "Supplies", "this month"
  stat sum(supply.cost month), "spent on soap and wax"
  list supply top 3, "No supplies bought yet."
  form supply, "Add supply"
list wash today, "No washes yet today. Tap a price when the first car is done."
section "Washes per vehicle", "today"
  each options wash.vehicle as v
    row gap 2
      v bold grow
      count(wash today where vehicle = v) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(count(wash today where vehicle = v) / max(count(wash today), 1), 0, 1), 4 fill accent radius 2
section "Last 7 days", "washes"
  daybars last 7 days, count(wash on it)
if sum(wash.price today) >= target
  "Daily target reached." color good bold
section "Newest first", "tap one to ed
```
Answer:
```
delete 6
```

### v4-e-acab2b0003
Request: remove the drawing reminder

Before:
```
app "Drawing" pencil mint
table sketch mins num 5..300 unit "min"
stat streak(sketch), "day streak"
quick sketch, mins, [15, 30, 60]
form sketch
list sketch
remind "Time to log drawing time" at 7:30
```
Answer:
```
delete 7
```

### v4-e-cc4ac5e18e
Request: remove the week before reminder

Before:
```
app "Special days" gift ocean
table event name text, kind pick Birthday|Anniversary = Birthday, day date, alert date, gift text?, budget money?
state n text = ""
state k pick Birthday|Anniversary = Birthday
state dt date = today
state g text = ""
state b money = 0
field n "Name"
choice k
field dt "Date"
field g "Gift idea"
field b "Budget"
button "Add" tap add event name = n, kind = k, day = dt, alert = dt - 7, gift = g, budget = b then set n = "" then set g = ""
remind "An event is coming in a week" at event.alert
remind "Event today" at event.day
each event sort day as e
  row card gap 1 tap edit e swipe remove e
    stack grow
      e.name bold
      e.kind e.day faint
      e.gift faint
    e.budget
    if e.day < today
      button "Next year" tap set e.day = addmonths(e.day, 12) then set e.alert = addmonths(e.alert, 12)
"Budget for upcoming" sum(event where day >= today, it.budget) faint
```
Answer:
```
delete 14
```

### v4-e-8d6f7e6887
Request: take off the hours goal

Before:
```
app "Bug Board" tool purple dark
table bug title text, severity pick Low|Medium|High|Critical = Medium, status pick Open|Fixing|Done = Open, hours num 1..40 = 2 unit "h"
setting budget num = 60 "Sprint hours budget"
state tab pick Open|Fixing|Done = Open
let critical = count(bug where severity = Critical and status != Done)
topbar bug, "Report bug"
statcard critical, "critical bugs still open", count(bug where severity = Critical)
goal sum(bug.hours where status = Done), budget, "hours fixed this sprint", "h"
row gap 1
  each options bug.status as s
    button s count(bug where status = s) fill if(tab = s, accent, soft) grow tap set tab = s
each bug where status = tab sort hours desc as b empty "No bugs in this column. Nice and quiet."
  row card gap 2 tap edit b swipe remove b
    stack grow gap 0
      b.title bold
      b.severity "-" b.hours "h" faint color if(b.severity = Critical, bad, muted)
    if b.status = Open
      button "Start" tap set b.status = Fixing
    if b.status = Fixing
      button "Done" tap set b.status = Done
section "By severity", "all bugs"
  share bug by severity, count(it), it.key
section "Bugs reported per day", "last 14 days"
  daybars last 14 days, count(bug on it)
section "Hours by status", "all bugs"
  share bug by status, sum(it.hours), it.key
section "Hours still to fix", "open and fixing"
  row gap 2
    stat sum(bug.hours where status = Open), "h open"
    stat sum(bug.hours where status = Fixing), "h in progress"
    stat budget - sum(b
```
Answer:
```
delete 8
```


## rename_button (83 rows)

### v4-e-213d83fe3b
Request: log problem should say Add problem

Before:
```
app "Practice" brain red
table solved name text, level pick Easy|Medium|Hard = Medium, topic text?
topbar solved, "Log problem"
statcard streak(solved), "day streak, best" best(solved) "· total" count(solved)
row gap 1
  each options solved.level as l
    stack card grow gap 0 align center
      count(solved where level = l) big
      l faint
section "Last 6 weeks"
  daygrid last 42 days, count(solved on it), 3
list solved by day, "No problems yet. Solve one easy one to start."
```
Answer:
```
replace 3
+ topbar solved, "Add problem"
```

### v4-e-f3901372fb
Request: the rotate button should say Change key

Before:
```
app "Key rotation" key teal
table akey name text, env pick Dev|Staging|Prod = Prod, expires date
topbar akey, "Add key"
statcard count(akey where env = Prod and expires <= today + 30), "prod keys expire within 30 days", count(akey where env = Prod)
section "Prod keys"
  each akey where env = Prod sort expires as k empty "No prod keys tracked."
    row tap edit k swipe remove k
      stack grow gap 0
        k.name bold color if(k.expires < today, bad, ink)
        k.expires faint
      button "Rotate" tap set k.expires = today + 90
section "Dev and staging"
  each akey where env != Prod sort expires as k empty "No dev or staging keys."
    row tap edit k swipe remove k
      k.name grow color if(k.expires < today, bad, ink)
      k.env faint
```
Answer:
```
replace 11
+       button "Change key" tap set k.expires = today + 90
```

### v4-e-f0f45b3098
Request: change the paid button to Received

Before:
```
app "School Fees" school red
table student name text, class pick Class_1|Class_2|Class_3|Class_4|Class_5 = Class_1
table payment student ref student, amount money = 1500
setting monthly money = 1500 "Monthly fee"
let expected = count(student) * monthly
let paid = count(student, count(it.payment month) > 0)
screen collect "Collect" money
  statcard sum(payment.amount month), "collected of" expected, expected
  row gap 2
    stat paid, "paid"
    stat count(student) - paid, "still to pay"
    stat round(paid * 100 / max(count(student), 1)), "percent paid"
  section "Not paid yet", "tap Paid when the fee arrives"
    each student sort name as s empty "No students yet. Add them on the Students tab."
      if count(s.payment month) = 0
        row card gap 2
          stack grow gap 0
            s.name bold
            s.class faint
          button "Paid" tap add payment student = s, amount = monthly
screen people "Students" users
  topbar student, "Add student"
  each student sort name as s empty "No students yet. Tap Add student."
    row card gap 2 tap edit s swipe remove s
      toggle s.payment month
      s.name bold grow
      s.class faint
  section "By class"
    share student by class, count(it), it.key
screen reports "Reports" chart
  section "Fees per month", "last 6 months"
    bars days last 6 months, sum(payment.amount month of it), monthname(it)
  section "Paid per class", "this month"
    share payment month by student.class, count(it), it.key
  section "Latest 
```
Answer:
```
replace 20
+           button "Received" tap add payment student = s, amount = monthly
```

### v4-e-c531278c93
Request: book appointment should say Book now

Before:
```
app "Salon Pro" tag plum
table client name text, phone text?
table service name text, price money
table product name text, qty num 0.., low num 0.. = 3
table visit client ref client, service ref service, paid money
let income = sum(visit.paid month)
screen home "Today" calendar
  stat income, "income this month"
  stat count(visit today), "appointments today"
  form visit, "Book appointment"
  each visit today as v
    row card
      v.client.name bold grow
      v.service.name
      v.paid
screen clients "Clients" users
  each client sort name as c
    row card tap edit c swipe remove c
      c.name bold grow
      count(c.visit) "visits" faint
  form client, "Add client"
screen prices "Prices" tag
  list service
  form service, "Add service"
screen stock "Stock" package
  each product sort qty as p
    row card gap 1 tap edit p
      p.name bold grow color if(p.qty <= p.low, warn, ink)
      button "-" tap set p.qty = p.qty - 1
      p.qty bold
      button "+" tap set p.qty = p.qty + 1
  form product, "Add product"
screen money "Income" wallet
  stat income, "this month"
  stat sum(visit.paid prev month), "last month"
  daybars last 7 days, sum(visit.paid on it)
  list visit by day
```
Answer:
```
replace 10
+   form visit, "Book now"
```

### v4-e-54c5e6a00d
Request: rename add idea to New idea

Before:
```
app "Idea Ranker" star orange
table idea title text, why long?, score num 1..5 = 3 "Score (1 to 5)", tried bool
state min num = 1
topbar idea, "Add idea"
statcard round(avg(idea.score) * 10) / 10, "average score across" plural(count(idea), "idea")
section "Scores", "how many at each"
  bars 1..5, count(idea where score = it), it
"Show ideas scoring at least" min faint
slider min 1..5
each idea where score >= min and tried = no sort score desc as i empty "No ideas at this score. Lower the slider or add one."
  row card gap 2 tap edit i swipe remove i
    stack grow gap 0
      i.title bold
      i.why faint
    i.score big
    toggle i.tried
```
Answer:
```
replace 4
+ topbar idea, "New idea"
```


## rename_field (25 rows)

### v4-e-a0f5d60f52
Request: the phone field of the kids should be named mobile

Before:
```
app "Birthday Party" gift pink
table kid name text, phone text?, coming bool, gift text?
table cost item text, amount money
setting budget money = 25000 "Party budget"
let spent = sum(cost.amount)
screen kids "Kids" users
  topbar kid, "Add child"
  statcard count(kid where coming = yes), "kids coming out of" count(kid), count(kid)
  each kid sort name as k empty "No kids yet. Add the first friend."
    row card gap 2 tap edit k swipe remove k
      toggle k.coming
      stack grow gap 0
        k.name bold
        k.phone faint
      if k.gift != ""
        icon gift
screen money "Costs" wallet
  topbar cost, "Add cost"
  goal spent, budget, if(spent > budget, "over budget", "spent so far")
  list cost, "No costs yet. Add the cake first."
screen gifts "Gifts" gift
  each kid where gift != "" as k empty "No gifts yet. Fill the gift on a child's card."
    row card
      k.name bold grow
      k.gift
```
Answer:
```
replace 2
+ table kid name text, mobile text? was phone, coming bool, gift text?
replace 14
+         k.mobile faint
```

### v4-e-3e726b0f62
Request: rename low to reorder_at

Before:
```
app "Salon Pro" tag plum
table client name text, phone text?
table service name text, price money
table product name text, qty num 0.., low num 0.. = 3
table visit client ref client, service ref service, paid money
let income = sum(visit.paid month)
screen home "Today" calendar
  stat income, "income this month"
  stat count(visit today), "appointments today"
  form visit, "Book appointment"
  each visit today as v
    row card
      v.client.name bold grow
      v.service.name
      v.paid
screen clients "Clients" users
  each client sort name as c
    row card tap edit c swipe remove c
      c.name bold grow
      count(c.visit) "visits" faint
  form client, "Add client"
screen prices "Prices" tag
  list service
  form service, "Add service"
screen stock "Stock" package
  each product sort qty as p
    row card gap 1 tap edit p
      p.name bold grow color if(p.qty <= p.low, warn, ink)
      button "-" tap set p.qty = p.qty - 1
      p.qty bold
      button "+" tap set p.qty = p.qty + 1
  form product, "Add product"
screen money "Income" wallet
  stat income, "this month"
  stat sum(visit.paid prev month), "last month"
  daybars last 7 days, sum(visit.paid on it)
  list visit by day
```
Answer:
```
replace 4
+ table product name text, qty num 0.., reorder_at num 0.. = 3 was low
replace 28
+       p.name bold grow color if(p.qty <= p.reorder_at, warn, ink)
```

### v4-e-dc2832ede4
Request: rename on_date to exam_date

Before:
```
app "Tuition Pro" school ocean
table student name text, fee money
table feepaid student ref student, amount money
table exam subject text, on_date date
table teacher name text, salary money
state m date = today
monthnav m
"Profit this month" sum(feepaid.amount month of m) - sum(teacher.salary) big
row gap 2
  stat sum(feepaid.amount month of m), "fees collected"
  stat sum(teacher.salary), "salaries"
  stat count(student), "students"
"Fees not yet paid this month" head
each student as s
  if sum(s.feepaid.amount month of m) < s.fee
    row card
      s.name grow
      s.fee - sum(s.feepaid.amount month of m) color bad
"Exams" head
each exam sort on_date as e
  row card tap edit e swipe remove e
    e.subject bold grow
    e.on_date
form student, "Add student"
form feepaid, "Add fee payment"
form exam, "Add exam"
form teacher, "Add teacher"
```
Answer:
```
replace 4
+ table exam subject text, exam_date date was on_date
replace 20
+ each exam sort exam_date as e
replace 23
+     e.exam_date
```

### v4-e-25941b7d23
Request: rename class to grade

Before:
```
app "School Fees" school red
table student name text, class pick Class_1|Class_2|Class_3|Class_4|Class_5 = Class_1
table payment student ref student, amount money = 1500
setting monthly money = 1500 "Monthly fee"
let expected = count(student) * monthly
let paid = count(student, count(it.payment month) > 0)
screen collect "Collect" money
  statcard sum(payment.amount month), "collected of" expected, expected
  row gap 2
    stat paid, "paid"
    stat count(student) - paid, "still to pay"
    stat round(paid * 100 / max(count(student), 1)), "percent paid"
  section "Not paid yet", "tap Paid when the fee arrives"
    each student sort name as s empty "No students yet. Add them on the Students tab."
      if count(s.payment month) = 0
        row card gap 2
          stack grow gap 0
            s.name bold
            s.class faint
          button "Paid" tap add payment student = s, amount = monthly
screen people "Students" users
  topbar student, "Add student"
  each student sort name as s empty "No students yet. Tap Add student."
    row card gap 2 tap edit s swipe remove s
      toggle s.payment month
      s.name bold grow
      s.class faint
  section "By class"
    share student by class, count(it), it.key
screen reports "Reports" chart
  section "Fees per month", "last 6 months"
    bars days last 6 months, sum(payment.amount month of it), monthname(it)
  section "Paid per class", "this month"
    share payment month by student.class, count(it), it.key
  section "Latest 
```
Answer:
```
replace 2
+ table student name text, grade pick Class_1|Class_2|Class_3|Class_4|Class_5 = Class_1 was class
replace 19
+             s.grade faint
replace 27
+       s.grade faint
replace 29
+     share student by grade, count(it), it.key
replace 34
+     share payment month by student.grade, count(it), it.key
```

### v4-e-cfc27092a5
Request: rename who to person

Before:
```
app "Kindness" smile pink
table act what text = "Kind act", who pick Family|Friend|Neighbour|Stranger|Colleague = Friend, kind pick Time|Gift|Words|Help = Help
setting monthly_goal num = 30 "Acts per month"
let n = count(act month)
topbar act, "Log an act"
statcard n, "kind acts this month, goal" monthly_goal, monthly_goal
quick act, who, [Family, Friend, Neighbour]
row gap 2
  statcard streak(act), "days in a row"
  statcard count(act week), "acts this week"
  statcard count(act all), "acts in all"
section "By type", "this month"
  share act month by kind, count(it), it.key
section "Who got your kindness", "all time"
  share act by who, count(it), it.key
section "Per day", "last 14 days"
  daybars last 14 days, count(act on it)
section "Calendar", "last 5 weeks"
  daygrid last 35 days, count(act on it), 3
section "Ideas for today"
  each ["Call someone you have not spoken to", "Pay for the next person", "Say thank you to a teacher", "Share your lunch"]
    row card gap 2
      icon smile
      it grow
section "Gifts and help", "this month"
  count(act month where kind = Gift or kind = Help) big
  "of" n "acts were gifts or help" faint
section "Your acts"
  list act by day, "No acts yet. Start small: hold a door, send a kind message."
row gap 2
  statcard count(act week), "entries this week"
  statcard count(act prev week), "entries last week"
section "Totals", "all time"
  count(act) "entries so far" big
  "This year" count(act year) faint
  "Last one" since(act) "days ago" 
```
Answer:
```
replace 2
+ table act what text = "Kind act", person pick Family|Friend|Neighbour|Stranger|Colleague = Friend was who, kind pick Time|Gift|Words|Help = Help
replace 7
+ quick act, person, [Family, Friend, Neighbour]
replace 15
+   share act by person, count(it), it.key
```


## reorder (41 rows)

### v4-e-965f8f87db
Request: put repairs tab first

Before:
```
app "Daily Rentals" home slate
table flat name text, rent money, due_day num 1..31 = 1
table tenant name text, flat ref flat, phone text?
table rentpay flat ref flat, amount money, receipt image?
table repair flat ref flat, what text, cost money?, done bool
screen units "Flats" home
  each flat as u
    row card gap 1 tap edit u
      stack grow
        u.name bold
        "rent" u.rent "due on day" u.due_day faint
      if count(u.rentpay month) > 0
        "Paid" color good
      else
        "Unpaid" color if(monthday(today) > u.due_day, bad, warn)
  form flat, "Add flat"
screen tenants "Tenants" users
  list tenant
  form tenant, "Add tenant"
screen rents "Rent" wallet
  stat sum(rentpay.amount month), "collected this month"
  form rentpay, "Record rent and receipt"
  each rentpay as r
    row card tap edit r
      r.flat.name bold grow
      r.amount
      image r.receipt
screen repairs "Repairs" pen
  each repair where done = no as r
    row card tap edit r
      toggle r.done
      r.flat.name r.what grow
  form repair, "Add repair"
  list repair where done = yes by day
```
Answer:
```
move 28-34 after 5
```

### v4-e-2f561e7d17
Request: add cow button should be before the share holder one

Before:
```
app "Qurbani Shares" paw mint
table cow_lot label text, price money
table taker cow_lot ref cow_lot, name text, shares num 1..7, paid money = 0
each cow_lot sort label as c
  let taken = sum(c.taker.shares)
  stack card gap 1 tap edit c
    row
      c.label bold grow
      taken "of 7 shares"
    goal sum(c.taker.paid), c.price, "collected"
    7 - taken "shares left" faint color if(taken >= 7, good, warn)
form taker, "Add share holder"
form cow_lot, "Add cow"
```
Answer:
```
move 12 after 13
```

### v4-e-f1086b7cea
Request: put the list right under the goal

Before:
```
app "Coffee runs" coffee mint
table run_out
setting target num = 3 "Weekly limit"
goal count(run_out week), target, "this week", "times"
button "Log run" tap add run_out
daybars last 7 days, count(run_out on it)
list run_out
```
Answer:
```
move 7 after 4
```

### v4-e-f4ac4b6232
Request: move the trend chart up under the vividness stat

Before:
```
app "Dream journal" moon slate
table dream title text, story long, vivid num 1..5, memo text?
stat round(avg(dream.vivid last 30 days) * 10) / 10, "average, last 30 days"
form dream
trend dream last 30 days sort at, it.vivid
list dream
```
Answer:
```
move 4 after 5
```

### v4-e-5f17a6eb6e
Request: put the week percentage under the count at the top

Before:
```
app "Ramadan goals" moon ink
table ibadah name text
table ibadah_done ibadah ref ibadah
let n = count(ibadah)
count(ibadah_done today) "of" n "done today" head
each ibadah
  row card gap 2 tap edit it swipe remove it
    stack grow
      it.name bold
    toggle it.ibadah_done
form ibadah
stat round(count(ibadah_done week) * 100 / (n * weekday(today))), "% done this week"
```
Answer:
```
move 12 after 5
```


## roman_urdu (106 rows)

### v4-c-a29e04eeb1
Request: salana kharch ka hisab

```
app "Salana kharch" wallet teal
table kharch cat pick Khana|Bill|Safar|Dawai|Aur = Khana, amount money
stat sum(kharch.amount year), "is saal"
bars options kharch.cat, sum(kharch.amount year where cat = it), it
form kharch, "Kharch likho"
```
Plan: # need: field cat, field amount, chart, total

### v4-c-8f93b56658
Request: shop ka maal mangwana hai

```
app "Maal mangwao" bag orange
table maal item text, qty num 1..1000, aaya bool
each maal where aaya = no sort item as m empty "Sab aa gaya"
  row card gap 2 tap edit m swipe remove m
    toggle m.aaya
    m.item bold grow
    m.qty faint
form maal, "Maal likho"
```
Plan: # need: field item, field qty, field aaya, tick, list

### v4-c-1c7a51ff13
Request: nai dukaan ka kharcha

```
app "Dukaan kharcha" bag orange
table kharcha what text, amount money
"Ab tak" sum(kharcha.amount) big
form kharcha, "Kharcha likho"
list kharcha by day
```
Plan: # need: field what, field amount, total, list

### v4-c-1684565a2a
Request: mohalle ki committee ka paani

```
app "Paani committee" drop ocean
table ghar number text, paid bool
count(ghar where paid = no) "ghar baqi" head color bad
each ghar sort number as g
  row card gap 2 tap edit g swipe remove g
    toggle g.paid
    g.number bold grow
form ghar, "Ghar likho"
```
Plan: # need: field number, field paid, total, tick, list

### v4-c-9a041b569d
Request: gas ka bill

```
app "Gas bill" bolt orange
table bill amount money, units num 0..999
stat last(bill.amount), "pichla bill"
trend bill last 12 months sort at, it.amount
form bill, "Bill likho"
```
Plan: # need: field amount, field units, chart, total


## sections (16 rows)

### v4-e-ca89d88e06
Request: put undo and new game in a section called Controls

Before:
```
app "Tennis" ball slate
table point team pick Me|Rival, pts num 1..500 = 1
let a = sum(point.pts where team = Me)
let b = sum(point.pts where team = Rival)
setting winat num = 6 "Play to"
row gap 2
  stack card grow align center
    "Me" bold
    a big
    button "+1" tap add point team = Me, pts = 1
    row gap 1
      button "+10" tap add point team = Me, pts = 10
  stack card grow align center
    "Rival" bold
    b big
    button "+1" tap add point team = Rival, pts = 1
    row gap 1
      button "+10" tap add point team = Rival, pts = 10
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Me win!" head color good
if b >= winat
  "Rival win!" head color good
"Lead:" abs(a - b) faint
list point
```
Answer:
```
replace 19-20
+ section "Controls"
+   button "Undo" tap remove last(point)
+   button "New game" tap remove all point
```

### v4-e-f1bfc45d95
Request: make a Stock section for the goal at the top

Before:
```
app "Scrap Yard" tool teal
table buy item pick Iron|Copper|Paper|Plastic|Aluminium = Iron, kg num 1..2000 = 50 unit "kg", rate money
table sold item pick Iron|Copper|Paper|Plastic|Aluminium = Iron, kg num 1..5000 = 100 unit "kg", rate money
setting capacity num = 3000 "Yard capacity (kg)"
let stock = sum(buy.kg) - sum(sold.kg)
let margin = sum(sold, it.kg * it.rate) - sum(buy, it.kg * it.rate)
topbar buy, "Log purchase"
goal stock, capacity, "kg in the yard", "kg"
row gap 2
  stat sum(buy today, it.kg * it.rate), "bought today"
  stat sum(sold today, it.kg * it.rate), "sold today"
  stat margin, "margin so far"
section "Stock by metal", "bought minus sold"
  each options buy.item as m
    row gap 2
      m bold grow
      sum(buy.kg where item = m) - sum(sold.kg where item = m) "kg" faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp((sum(buy.kg where item = m) - sum(sold.kg where item = m)) / max(capacity / 3, 1), 0, 1), 4 fill accent radius 2
section "Kilos bought per day", "last 14 days"
  daybars last 14 days, sum(buy.kg on it)
section "Spend by metal", "this month"
  share buy month by item, sum(it, it.kg * it.rate), it.key
section "Sell scrap"
  form sold, "Save sale"
section "Latest sales"
  each sold top 4 as s empty "Nothing sold yet. Record the first load."
    row card gap 2 tap edit s swipe remove s
      stack grow gap 0
        s.item bold
        s.kg "kg at" s.rate faint
      s.kg * s.rate bold
section 
```
Answer:
```
replace 8-12
+ section "Stock"
+   goal stock, capacity, "kg in the yard", "kg"
+   row gap 2
+     stat sum(buy today, it.kg * it.rate), "bought today"
+     stat sum(sold today, it.kg * it.rate), "sold today"
+     stat margin, "margin so far"
```

### v4-e-cb97e74cd9
Request: make the book of the month part a section

Before:
```
app "Reading Club" book slate
table member name text
table pick_ title text
table meeting day date, place text?
table vote member ref member, chosen ref pick_
table progress member ref member, pct num 0..100
remind "Book club meeting" at meeting.day
"Book of the month" head
each pick_ sort at desc top 1
  it.title big
"Votes" head
each pick_
  row
    it.title grow
    count(it.vote) "votes" bold
"Reading progress" head
bars member, last(it.progress.pct), it.name
"Meetings" head
each meeting where day >= today sort day
  it.day it.place
form member, "Add member"
form pick_, "Add book option"
form vote, "Cast vote"
form progress, "Update progress"
form meeting, "Add meeting"
```
Answer:
```
replace 8-10
+ section "Book of the month"
+   "Book of the month" head
+   each pick_ sort at desc top 1
+     it.title big
```

### v4-e-f16f43632f
Request: make customer name and pickup date a section titled Order details

Before:
```
app "Gift Boxes" gift purple
table order customer text, pickup date, price money
state box pick Small|Medium|Large = Medium
state almonds num = 200
state pistachios num = 100
state dates num = 300
state customer text = ""
state pickup date = today
let grams = almonds + pistachios + dates
let price = almonds * 2.4 + pistachios * 4 + dates * 0.9 + if(box = Small, 150, if(box = Medium, 250, 400))
choice box
section "What goes inside"
  "Almonds" almonds "g" faint
  slider almonds 0..1000
  "Pistachios" pistachios "g" faint
  slider pistachios 0..1000
  "Dates" dates "g" faint
  slider dates 0..1500
statcard price, "for a" box "box of" grams "g"
field customer "Customer name"
field pickup "Pickup date"
button "Save order" fill accent tap add order customer = customer, pickup = pickup, price = price
section "Orders", "Saved:" count(order)
  each order sort pickup as o empty "No orders saved yet."
    row gap 2 tap edit o swipe remove o
      o.customer grow
      o.pickup faint
      o.price bold
```
Answer:
```
replace 20-21
+ section "Order details"
+   field customer "Customer name"
+   field pickup "Pickup date"
```

### v4-e-9584539e1e
Request: make a Controls section for the buttons

Before:
```
app "Ping pong" ball plum
table point team pick Left|Right, pts num 1..500 = 1
let a = sum(point.pts where team = Left)
let b = sum(point.pts where team = Right)
setting winat num = 21 "Play to"
row gap 2
  stack card grow align center
    "Left" bold
    a big
    button "+1" tap add point team = Left, pts = 1
    row gap 1
      button "+2" tap add point team = Left, pts = 2
      button "+3" tap add point team = Left, pts = 3
  stack card grow align center
    "Right" bold
    b big
    button "+1" tap add point team = Right, pts = 1
    row gap 1
      button "+2" tap add point team = Right, pts = 2
      button "+3" tap add point team = Right, pts = 3
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Left win!" head color good
if b >= winat
  "Right win!" head color good
"Lead:" abs(a - b) faint
list point
```
Answer:
```
replace 21-22
+ section "Controls"
+   button "Undo" tap remove last(point)
+   button "New game" tap remove all point
```


## typo_short (17 rows)

### v4-c-34820d178c
Request: pakistan ke sab sheher ka mosam

```
ask "Molde apps cannot get live weather. Do you want a weather diary where you type the city, the temperature and the sky?" "Yes, a weather diary" "No, never mind"
```

### v4-c-70fbd763fb
Request: kharch trackr

```
app "Kharch" wallet teal
table kharch what text, amount money
stat sum(kharch.amount month), "is mahine"
form kharch, "Kharch likho"
list kharch by day
```
Plan: # need: field what, field amount, total, list

### v4-c-138d6d7a6e
Request: udhaar ka khatta

```
app "Udhaar khata" book red
table udhaar name text, amount money, paid bool
"Baqi" sum(udhaar.amount where paid = no) big
each udhaar where paid = no sort name as u
  row card gap 2 tap edit u swipe remove u
    toggle u.paid
    u.name bold grow
    u.amount bold
form udhaar, "Udhaar likho"
```
Plan: # need: field name, field amount, field paid, total, tick, list

### v4-c-41ea0728a5
Request: phone repir shop ka hisab

```
app "Repair shop" phone slate
table repair customer text, amount money, done bool
"Baqi" sum(repair.amount where done = no) big
each repair where done = no sort at as r
  row card gap 2 tap edit r swipe remove r
    toggle r.done
    r.customer bold grow
    r.amount bold
form repair, "Repair likho"
```
Plan: # need: field customer, field amount, field done, total, tick, list

### v4-c-aa0c3787eb
Request: shop ka stok

```
app "Stock" bag orange
table item name text, qty num 0..
each item sort qty as i
  row card gap 2 tap edit i swipe remove i
    i.name bold grow
    i.qty bold
form item, "Cheez likho"
```
Plan: # need: field name, field qty, list
