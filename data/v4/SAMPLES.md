# Samples, 5 random new v4.1 rows per class


## add_option (47 rows)

### v4-e-b41508b733
Request: add a kids bike type

Before:
```
app "Bike Hire" bike yellow
table rental rider text, bike pick City|Mountain|Electric = City, hours num 1..48 = 2 unit "h", rate money = 150, returned bool
setting fleet num = 12 "Bikes in the fleet"
let out = count(rental where returned = no)
topbar rental, "New rental"
goal out, fleet, "bikes out right now", "bikes"
row gap 2
  stat fleet - out, "bikes in the shop"
  stat sum(rental, it.hours * it.rate), "total rented value"
  stat sum(rental today, it.hours * it.rate), "income today"
section "Out now", "tick when the bike comes back"
  each rental where returned = no sort at as r empty "All bikes are back in the shop."
    row card gap 2 tap edit r swipe remove r
      toggle r.returned
      stack grow gap 0
        r.rider bold
        r.bike "-" r.hours "h at" r.rate faint
      r.hours * r.rate bold
section "Income by bike", "this month"
  share rental month by bike, sum(it, it.hours * it.rate), it.key
section "Rentals per day", "last 14 days"
  daybars last 14 days, count(rental on it)
section "Hours per bike type"
  each options rental.bike as b
    row gap 2
      b bold grow
      sum(rental.hours month where bike = b) "h" faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(rental.hours month where bike = b) / max(sum(rental.hours month), 1), 0, 1), 4 fill accent radius 2
section "Busy weekends", "last 5 weeks"
  heat last 35 days, count(rental on it), 6
section "Returned", count(rental where returned = y
```
Answer:
```
replace 2
+ table rental rider text, bike pick City|Mountain|Electric|Kids = City, hours num 1..48 = 2 unit "h", rate money = 150, returned bool
```

### v4-e-2890bfffc6
Request: add Zara as an author

Before:
```
app "Review Queue" list blue
table pr title text, author pick Ali|Sara|Bilal|Hina|Omar = Ali, lines num 1..5000 = 120 unit "lines", status pick Waiting|Changes|Approved|Merged = Waiting
setting big num = 400 "Big PR above (lines)"
state tab pick Waiting|Changes|Approved|Merged = Waiting
let waiting = count(pr where status = Waiting)
topbar pr, "Add PR"
row gap 2
  stat waiting, "waiting for review"
  stat count(pr where lines > big and status != Merged), "big PRs open"
  stat count(pr where status = Merged and at >= today - 7), "merged this week"
row gap 1
  each options pr.status as s
    button s count(pr where status = s) fill if(tab = s, accent, soft) grow tap set tab = s
each pr where status = tab sort at as p empty "No pull requests here."
  row card gap 2 tap edit p swipe remove p
    stack grow gap 0
      p.title bold
      p.author "-" p.lines "lines" faint color if(p.lines > big, warn, muted)
    if p.status = Waiting
      button "Approve" tap set p.status = Approved
    if p.status = Approved
      button "Merge" tap set p.status = Merged
section "Lines per author", "open work"
  bars pr where status != Merged by author, sum(it.lines), it.key
section "PRs opened", "last 14 days"
  daybars last 14 days, count(pr on it)
section "Review load", "who has the most waiting"
  share pr where status = Waiting by author, count(it), it.key
section "Average size", "all PRs"
  stat round(avg(pr.lines)), "lines per PR"
section "PRs waiting per author", "open reviews"
  each op
```
Answer:
```
replace 2
+ table pr title text, author pick Ali|Sara|Bilal|Hina|Omar|Zara = Ali, lines num 1..5000 = 120 unit "lines", status pick Waiting|Changes|Approved|Merged = Waiting
```

### v4-e-9b45fa6110
Request: school opened a sixth class, add it

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
+ table student name text, class pick Class_1|Class_2|Class_3|Class_4|Class_5|Class_6 = Class_1
```

### v4-e-aa2c955401
Request: add toughened glass to the types

Before:
```
app "Glass Quote" box blue
table quote customer text, glass pick Plain|Tinted|Frosted|Mirror = Plain, sqft num 0..1000, total money
setting plain money = 180 "Plain glass per sq ft"
setting tinted money = 260 "Tinted per sq ft"
setting frosted money = 300 "Frosted per sq ft"
setting mirror money = 350 "Mirror per sq ft"
state who text = ""
state kind pick Plain|Tinted|Frosted|Mirror = Plain
state w num = 36
state h num = 48
state n num = 1
let sqft = round(w * h * n / 144 * 10) / 10
let rate = if(kind = Plain, plain, if(kind = Tinted, tinted, if(kind = Frosted, frosted, mirror)))
topbar quote, "Add old quote"
choice kind
"Width" w "in" faint
slider w 6..120
"Height" h "in" faint
slider h 6..120
row gap 2 align center
  "Panes" n bold grow
  button "-" tap set n = max(n - 1, 1)
  button "+" tap set n = n + 1
statcard round(sqft * rate), "for" sqft "sq ft of" kind
field who "Customer name"
button "Save quote" fill accent tap add quote customer = who, glass = kind, sqft = sqft, total = round(sqft * rate) then set who = ""
list quote top 5, "No quotes saved yet."
```
Answer:
```
replace 2
+ table quote customer text, glass pick Plain|Tinted|Frosted|Mirror|Toughened = Plain, sqft num 0..1000, total money
```

### v4-e-4fec05a20d
Request: a third person joined, add green

Before:
```
app "Ludo" dice ocean
table point team pick Red|Blue, pts num 1..500 = 1
let a = sum(point.pts where team = Red)
let b = sum(point.pts where team = Blue)
setting winat num = 50 "Play to"
row gap 2
  stack card grow align center
    "Red" bold
    a big
    button "+1" tap add point team = Red, pts = 1
    row gap 1
      button "+5" tap add point team = Red, pts = 5
  stack card grow align center
    "Blue" bold
    b big
    button "+1" tap add point team = Blue, pts = 1
    row gap 1
      button "+5" tap add point team = Blue, pts = 5
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Red win!" head color good
if b >= winat
  "Blue win!" head color good
"Lead:" abs(a - b) faint
list point
```
Answer:
```
replace 2
+ table point team pick Red|Blue|Green, pts num 1..500 = 1
```


## remove_one (37 rows)

### v4-e-a3b466ad3e
Request: delete the bars chart, I never look at it

Before:
```
app "Eidi Envelopes" gift orange
state n1 num = 6
state a1 money = 200
state n2 num = 5
state a2 money = 500
state n3 num = 3
state a3 money = 1000
state budget money = 8000
let total = n1 * a1 + n2 * a2 + n3 * a3
section "Little ones (up to 8)"
  field n1 "How many"
  field a1 "Each gets"
section "Middle (9 to 14)"
  field n2 "How many"
  field a2 "Each gets"
section "Teens"
  field n3 "How many"
  field a3 "Each gets"
field budget "My eidi budget"
bars [1, 2, 3], if(it = 1, n1 * a1, if(it = 2, n2 * a2, n3 * a3)), if(it = 1, "Little", if(it = 2, "Middle", "Teens"))
statcard round(total), "eidi in total", budget
if total > budget
  "Over by" round(total - budget) bold color bad
else
  "Within budget, " round(budget - total) "left." bold color good
```
Answer:
```
delete 20
```

### v4-e-b0abc477b3
Request: delete the monthly paid goal

Before:
```
app "Invoices" money teal
table invoice client text, amount money, issued date = today, paid bool
setting goal money = 250000 "Monthly income goal"
let owed = sum(invoice.amount where paid = no)
let late = count(invoice where paid = no and issued < today - 30)
topbar invoice, "New invoice"
statcard owed, "still owed by" count(invoice where paid = no) "clients"
if late > 0
  "Chase" plural(late, "invoice") "older than 30 days" bold color bad
goal sum(invoice.amount month where paid = yes), goal, "paid this month"
section "Income per month", "last 6 months"
  bars days last 6 months, sum(invoice.amount month of it where paid = yes), monthname(it)
section "Top clients", "by amount billed"
  share invoice by client, sum(it.amount), it.key
section "Unpaid"
  each invoice where paid = no sort issued as i empty "Everything is paid. Enjoy it."
    row card gap 2 tap edit i swipe remove i
      toggle i.paid
      stack grow gap 0
        i.client bold
        "Issued" i.issued faint color if(i.issued < today - 30, bad, muted)
      i.amount bold
section "Paid", count(invoice where paid = yes)
  list invoice where paid = yes top 6, "Nothing paid yet."
section "Billed per week", "last 4 weeks"
  daybars last 28 days, sum(invoice.amount on it)
section "Average invoice", "all time"
  row gap 2
    stat round(avg(invoice.amount)), "average amount"
    stat max(invoice.amount), "biggest invoice"
    stat count(invoice month), "sent this month"
section "Slowest payers", "unpaid, oldest firs
```
Answer:
```
delete 10
```

### v4-e-8576cc61d2
Request: remove the quick price buttons, I type the price myself

Before:
```
app "Juice Bar" cup orange
table sale drink pick Orange|Mango|Sugarcane|Carrot|Mix = Orange, price money = 150
setting target money = 12000 "Daily takings target"
state flavour pick Orange|Mango|Sugarcane|Carrot|Mix = Orange
"Juice Bar" head
choice flavour
quick sale, price, [100, 150, 200, 250]
button "Sell a" flavour "for 150" tap add sale drink = flavour, price = 150
statcard sum(sale.price today), "taken today of" target, target
row gap 2
  stat count(sale today), "glasses today"
  stat count(sale week), "glasses this week"
  stat round(sum(sale.price today) / max(count(sale today), 1)), "average per glass"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(sale.price on it), target
section "Flavours", "glasses this week"
  share sale week by drink, count(it), it.key
section "Flavours today"
  each options sale.drink as f
    row gap 2
      f bold grow
      count(sale today where drink = f) faint
      draw 100, 4 width 70
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(count(sale today where drink = f) / max(count(sale today), 1), 0, 1), 4 fill accent radius 2
section "Busy days", "last 5 weeks"
  heat last 35 days, count(sale on it), 40
list sale today, "No sales yet today. Tap a price when the first glass goes."
section "Best day", "this month"
  stat max(days month, sum(sale.price on it)), "taken in one day"
section "Totals", "this month"
  row gap 2
    stat count(sale month), "glasses"
    stat sum(sale.price month), "takings"
```
Answer:
```
delete 7
```

### v4-e-99f923377c
Request: remove the book club reminder, we meet whenever now

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
delete 7
```

### v4-e-d168f662d4
Request: no pill reminder, delete it

Before:
```
app "Life Nudges" bell plum
table birthday person text, day date
table bill name text, due date, amount money?, paid bool
table pill name text, time time = 8:00
remind "A birthday is today. Say hello." at birthday.day
remind "A bill is due in two days" at bill.due - 2d at 9:00
remind "Time for your pill" at pill.time
screen b "Birthdays" gift
  topbar birthday, "Add birthday"
  each birthday sort day as p empty "No birthdays yet. Add the ones you always forget."
    row card gap 2 tap edit p swipe remove p
      p.person bold grow
      p.day faint
screen bills "Bills" money
  topbar bill, "Add bill"
  each bill where paid = no sort due as x empty "No unpaid bills. Add the next one."
    row card gap 2 tap edit x swipe remove x
      toggle x.paid
      stack grow gap 0
        x.name bold
        x.due faint color if(x.due < today, bad, muted)
      x.amount bold
screen pills "Pills" pill
  topbar pill, "Add pill"
  each pill sort time as q empty "No pills yet."
    row card gap 2 tap edit q swipe remove q
      q.name bold grow
      q.time faint
```
Answer:
```
delete 7
```


## rename_button (39 rows)

### v4-e-adb28ab90c
Request: rename add task to New task

Before:
```
app "Daily Wedding Planner" gift plum
table func name text, budget money
table guest name text, rsvp pick Pending|Yes|No = Pending
table vendor name text, phone text?, job text?
table chore name text, due date, done bool
remind "Wedding task due" at chore.due
"Guests coming" count(guest where rsvp = Yes) "of" count(guest) head
each guest sort name
  row card
    it.name grow
    it.rsvp bold color if(it.rsvp = Yes, good, if(it.rsvp = No, bad, muted))
    button "Change" tap edit it
form guest, "Add guest"
"Budget per function" head
each func
  row card
    it.name grow
    it.budget bold
form func, "Add function"
"Vendors" head
list vendor
form vendor, "Add vendor"
"Checklist" head
each chore sort due
  row card
    it.name grow
    it.due faint
    toggle it.done
form chore, "Add task"
```
Answer:
```
replace 29
+ form chore, "New task"
```

### v4-e-e7a9fdcbb8
Request: rename save session to Keep session

Before:
```
app "Yoga" leaf purple
table session mins num 5..120 unit "min", focus pick Flexibility|Strength|Balance|Calm = Calm, note text?
setting weekly_goal num = 90 "Minutes per week"
let wk = sum(session.mins week)
remind "Roll out your mat" at 6:30 on mon wed fri
screen practice "Practice" leaf
  statcard wk, "min this week, goal" weekly_goal, weekly_goal
  weekdots count(session on it) > 0
  quick session, mins, [10, 20, 30]
  form session, "Save session"
  section "Today"
    list session today, "No practice yet today. Even ten minutes help."
  section "Pose ideas"
    each ["Child's pose", "Downward dog", "Warrior two", "Tree pose"]
      row gap 2
        icon leaf
        it grow
screen progress "Progress" chart
  section "Minutes per day", "last 14 days"
    daybars last 14 days, sum(session.mins on it)
  section "Focus", "all time"
    share session by focus, sum(it.mins), it.key
  section "Session length", "last 60 days"
    trend session last 60 days, it.mins
  row gap 2
    statcard streak(session), "day streak"
    statcard sum(session.mins month), "min this month"
  section "Practice days", "last 5 weeks"
    daygrid last 35 days, count(session on it), 2
screen history "History" list
  list session by day, "No sessions yet. Your practice shows up here."
```
Answer:
```
replace 10
+   form session, "Keep session"
```

### v4-e-b59532689e
Request: change add asset to New asset

Before:
```
app "Estate assets" home green
table asset name text, value money
setting debts money = 0 "Debts to clear"
state mother bool = yes
state sons num = 2
state daughters num = 1
let net = max(sum(asset.value) - debts, 0)
let wife_part = if(mother, net / 8, 0)
let per = (net - wife_part) / max(sons * 2 + daughters, 1)
topbar asset, "Add asset"
statcard net, "estate after debts"
section "Family"
  row gap 2
    toggle mother
    "Wife alive (gets 1/8)" grow
  "Sons" sons faint
  slider sons 0..6
  "Daughters" daughters faint
  slider daughters 0..6
if net > 0 and sons + daughters > 0
  section "Shares"
    if mother
      row
        "Wife" grow
        round(wife_part) bold
    row
      "Each son" grow
      round(per * 2) bold
    row
      "Each daughter" grow
      round(per) bold
list asset top 6, "No assets yet. Add the house, plot, gold and bank money."
```
Answer:
```
replace 10
+ topbar asset, "New asset"
```

### v4-e-a2ae34932c
Request: rename add student to New student

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
replace 24
+ form student, "New student"
```

### v4-e-8647a61143
Request: make the sell a button say Sell one

Before:
```
app "Juice Bar" cup orange
table sale drink pick Orange|Mango|Sugarcane|Carrot|Mix = Orange, price money = 150
setting target money = 12000 "Daily takings target"
state flavour pick Orange|Mango|Sugarcane|Carrot|Mix = Orange
"Juice Bar" head
choice flavour
quick sale, price, [100, 150, 200, 250]
button "Sell a" flavour "for 150" tap add sale drink = flavour, price = 150
statcard sum(sale.price today), "taken today of" target, target
row gap 2
  stat count(sale today), "glasses today"
  stat count(sale week), "glasses this week"
  stat round(sum(sale.price today) / max(count(sale today), 1)), "average per glass"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(sale.price on it), target
section "Flavours", "glasses this week"
  share sale week by drink, count(it), it.key
section "Flavours today"
  each options sale.drink as f
    row gap 2
      f bold grow
      count(sale today where drink = f) faint
      draw 100, 4 width 70
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(count(sale today where drink = f) / max(count(sale today), 1), 0, 1), 4 fill accent radius 2
section "Busy days", "last 5 weeks"
  heat last 35 days, count(sale on it), 40
list sale today, "No sales yet today. Tap a price when the first glass goes."
section "Best day", "this month"
  stat max(days month, sum(sale.price on it)), "taken in one day"
section "Totals", "this month"
  row gap 2
    stat count(sale month), "glasses"
    stat sum(sale.price month), "takings"
```
Answer:
```
replace 8
+ button "Sell one" flavour "for 150" tap add sale drink = flavour, price = 150
```


## rename_field (25 rows)

### v4-e-140ecfaa83
Request: leads should be called enquiries

Before:
```
app "Ad Spend" chart yellow
table campaign name text, channel pick Facebook|Google|Instagram|Flyers|WhatsApp = Facebook, spend money, leads num 0..5000 = 0, sales num 0..5000 = 0
setting budget money = 100000 "Monthly ad budget"
let spent = sum(campaign.spend month)
topbar campaign, "Add campaign"
statcard spent, "spent this month of" budget, budget
row gap 2
  stat sum(campaign.leads month), "leads"
  stat sum(campaign.sales month), "sales"
  stat round(spent / max(sum(campaign.leads month), 1)), "cost per lead"
section "Cost per lead", "by channel, this month"
  bars campaign month by channel, round(sum(it.spend) / max(sum(it.leads), 1)), it.key
section "Spend", "by channel"
  share campaign month by channel, sum(it.spend), it.key
section "Leads to sales"
  each options campaign.channel as c
    row gap 2
      c bold grow
      sum(campaign.sales month where channel = c) "of" sum(campaign.leads month where channel = c) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(campaign.sales month where channel = c) / max(sum(campaign.leads month where channel = c), 1), 0, 1), 4 fill accent radius 2
section "Spend per day", "last 14 days"
  daybars last 14 days, sum(campaign.spend on it)
section "Best campaigns", "most sales"
  each campaign sort sales desc top 3 as c empty "No campaigns yet. Add the first one."
    row card gap 2 tap edit c swipe remove c
      stack grow gap 0
        c.name bold
        c.channel fai
```
Answer:
```
replace 2
+ table campaign name text, channel pick Facebook|Google|Instagram|Flyers|WhatsApp = Facebook, spend money, enquiries num 0..5000 = 0 was leads, sales num 0..5000 = 0
replace 8
+   stat sum(campaign.enquiries month), "leads"
replace 10
+   stat round(spent / max(sum(campaign.enquiries month), 1)), "cost per lead"
replace 12
+   bars campaign month by channel, round(sum(it.spend) / max(sum(it.enquiries), 1)), it.key
replace 19
+       sum(campaign.sales month where channel = c) "of" sum(campaign.enquiries month where channel = c) faint
replace 22
+         rect 0, 0, 100 * clamp(sum(campaign.sales month where channel = c) / max(sum(campaign.enquiries month where channel = c), 1), 0, 1), 4 fill accent radius 2
```

### v4-e-00b72ab554
Request: call pts score

Before:
```
app "Table tennis" ball plum
table point team pick Home|Away, pts num 1..500 = 1
let a = sum(point.pts where team = Home)
let b = sum(point.pts where team = Away)
setting winat num = 11 "Play to"
row gap 2
  stack card grow align center
    "Home" bold
    a big
    button "+1" tap add point team = Home, pts = 1
    row gap 1
      button "+2" tap add point team = Home, pts = 2
      button "+3" tap add point team = Home, pts = 3
  stack card grow align center
    "Away" bold
    b big
    button "+1" tap add point team = Away, pts = 1
    row gap 1
      button "+2" tap add point team = Away, pts = 2
      button "+3" tap add point team = Away, pts = 3
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
if a >= winat
  "Home win!" head color good
if b >= winat
  "Away win!" head color good
```
Answer:
```
replace 2-4
+ table point team pick Home|Away, score num 1..500 = 1 was pts
+ let a = sum(point.score where team = Home)
+ let b = sum(point.score where team = Away)
replace 10
+     button "+1" tap add point team = Home, score = 1
replace 12-13
+       button "+2" tap add point team = Home, score = 2
+       button "+3" tap add point team = Home, score = 3
replace 17
+     button "+1" tap add point team = Away, score = 1
replace 19-20
+       button "+2" tap add point team = Away, score = 2
+       button "+3" tap add point team = Away, score = 3
```

### v4-e-c20fbf3c13
Request: the done field in repairs should be named fixed

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
replace 5
+ table repair flat ref flat, what text, cost money?, fixed bool was done
replace 29
+   each repair where fixed = no as r
replace 31
+       toggle r.fixed
replace 34
+   list repair where fixed = yes by day
```

### v4-e-c76add319c
Request: rename job to service for vendors

Before:
```
app "Daily Wedding Planner" gift plum
table func name text, budget money
table guest name text, rsvp pick Pending|Yes|No = Pending
table vendor name text, phone text?, job text?
table chore name text, due date, done bool
remind "Wedding task due" at chore.due
"Guests coming" count(guest where rsvp = Yes) "of" count(guest) head
each guest sort name
  row card
    it.name grow
    it.rsvp bold color if(it.rsvp = Yes, good, if(it.rsvp = No, bad, muted))
    button "Change" tap edit it
form guest, "Add guest"
"Budget per function" head
each func
  row card
    it.name grow
    it.budget bold
form func, "Add function"
"Vendors" head
list vendor
form vendor, "Add vendor"
"Checklist" head
each chore sort due
  row card
    it.name grow
    it.due faint
    toggle it.done
form chore, "Add task"
```
Answer:
```
replace 4
+ table vendor name text, phone text?, service text? was job
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


## reorder (20 rows)

### v4-e-46c0ef4e03
Request: lead line should show first, above the score row

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
move 25 after 18
```

### v4-e-9482eec434
Request: show the lead line above the score row

Before:
```
app "Bowling" ball ocean
table point team pick Lane_1|Lane_2, pts num 1..500 = 1
let a = sum(point.pts where team = Lane_1)
let b = sum(point.pts where team = Lane_2)
setting winat num = 200 "Play to"
row gap 2
  stack card grow align center
    "Lane 1" bold
    a big
    button "+1" tap add point team = Lane_1, pts = 1
    row gap 1
      button "+2" tap add point team = Lane_1, pts = 2
  stack card grow align center
    "Lane 2" bold
    b big
    button "+1" tap add point team = Lane_2, pts = 1
    row gap 1
      button "+2" tap add point team = Lane_2, pts = 2
button "Undo" tap remove last(point)
button "New game" tap remove all point
"Lead:" abs(a - b) faint
if a >= winat
  "Lane 1 win!" head color good
if b >= winat
  "Lane 2 win!" head color good
list point
```
Answer:
```
move 21 after 18
```

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

### v4-e-2d8e9fb182
Request: progress tab should come first, I check that most

Before:
```
app "Study" school mint
table subject name text
table lesson subject ref subject, day pick Mon|Tue|Wed|Thu|Fri|Sat = Mon, start time, mins num 15..180 = 45
table studied subject ref subject, mins num 1..
table flash word text, meaning text
setting work dur = 25m "Focus length"
state i num = 0
state flipped bool = no
state sub ref subject
screen plan "Timetable" calendar
  each options lesson.day as dd
    stack gap 1
      dd bold
      each lesson where day = dd sort start as l
        row card tap edit l swipe remove l
          l.start l.subject.name grow
          l.mins "min"
  form lesson, "Add lesson"
  form subject, "Add subject"
screen focus "Focus" timer
  choice sub
  timer work, "Focus", add studied subject = sub, mins = 25 then notify "Break time"
  sum(studied.mins today) "min studied today" head
screen cards "Cards" cards
  each flash sort at as c
    if index = i
      stack card gap 2 pad 4 align center tap set flipped = not flipped
        if flipped
          c.meaning big
        else
          c.word big
  row gap 1
    button "Previous" tap set i = clamp(i - 1, 0, count(flash) - 1) then set flipped = no
    button "Next" tap set i = clamp(i + 1, 0, count(flash) - 1) then set flipped = no
  form flash, "Add card"
screen progress "Progress" chart
  daybars last 7 days, sum(studied.mins on it)
  share subject, sum(it.studied.mins week), it.name
```
Answer:
```
move 36-38 after 9
```

### v4-e-e53c32873f
Request: move sell scrap up under the stock goal

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
move 25-26 after 12
```


## roman_urdu (81 rows)

### v4-c-4e3c384e9d
Request: roze ka record

```
app "Roze" moon plum
table roza kept bool
stat count(roza where kept = yes), "roze rakhe"
calendar roza
form roza, "Roza rakha"
```
Plan: # need: field kept, total, calendar, tick

### v4-c-39cd9e4a7b
Request: chai ke dhabay ki bikri

```
app "Chai dhaba" cup orange
table bikri cups num 1..500, amount money
stat sum(bikri.cups today), "aaj ke cup"
stat sum(bikri.amount today), "aaj ki bikri"
daybars last 7 days, sum(bikri.amount on it)
form bikri, "Bikri likho"
```
Plan: # need: field cups, field amount, chart, total

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

### v4-c-d4482700ec
Request: gari ki service

```
app "Gari service" car slate
table service km num 0..500000, cost money, on date = today
stat last(service.km), "akhri service par km"
each service sort on desc as s
  row card gap 2 tap edit s swipe remove s
    s.on bold grow
    s.km faint
    s.cost
form service, "Service hui"
```
Plan: # need: field km, field cost, field on, total, list

### v4-c-dad45cc9d5
Request: hajj ke liye paise

```
app "Hajj" moon yellow
table jama amount money
setting target money = 1200000 "Hajj ka kharch"
goal sum(jama.amount), target, "jama hua"
quick jama, amount, [5000, 10000, 50000]
```
Plan: # need: field amount, goal, total, quick buttons


## sections (16 rows)

### v4-e-a74b1fc142
Request: put the top cards in a section called Today

Before:
```
app "Hen House" egg yellow
table collect eggs num 0..2000, broken num 0..200 = 0
table feed bags num 1..50 = 1, cost money
setting flock num = 400 "Birds in the flock"
let eggs_today = sum(collect.eggs today)
topbar collect, "Log eggs"
statcard round(eggs_today * 100 / flock), "percent laying rate, from" eggs_today "eggs", 100
row gap 2
  stat sum(collect.broken today), "broken today"
  stat sum(collect.eggs week), "eggs this week"
  stat round(sum(collect.eggs week) / 12), "dozen this week"
section "Eggs per day", "last 30 days"
  trend days last 30 days, sum(collect.eggs on it)
section "Collecting days", "last 5 weeks"
  heat last 35 days, count(collect on it), 2
section "Feed", "bags this month" sum(feed.bags month)
  row gap 2
    stat sum(feed.cost month), "feed cost"
    stat round(sum(feed.cost month) / max(sum(collect.eggs month), 1) * 100) / 100, "feed cost per egg"
  each feed top 3 as f empty "No feed bought yet. Add a purchase below."
    row gap 1
      f.bags "bags" grow
      f.cost bold
form feed, "Add feed"
list collect today, "No eggs logged today. Log the morning round."
section "Broken eggs", "last 7 days"
  daybars last 7 days, sum(collect.broken on it)
section "Best day this month", "eggs"
  stat max(days month, sum(collect.eggs on it)), "eggs in one day"
section "Dozens to sell", "this week"
  row gap 2
    stat floor(sum(collect.eggs week) / 12), "full dozens"
    stat sum(collect.eggs week) % 12, "loose eggs"
if sum(collect.broken week) * 20 > sum(col
```
Answer:
```
replace 7-11
+ section "Today"
+   statcard round(eggs_today * 100 / flock), "percent laying rate, from" eggs_today "eggs", 100
+   row gap 2
+     stat sum(collect.broken today), "broken today"
+     stat sum(collect.eggs week), "eggs this week"
+     stat round(sum(collect.eggs week) / 12), "dozen this week"
```

### v4-e-4d782a64de
Request: put the two buttons in a section

Before:
```
app "Darts" target mint
table point team pick Mum|Dad, pts num 1..500 = 1
let a = sum(point.pts where team = Mum)
let b = sum(point.pts where team = Dad)
setting winat num = 301 "Play to"
row gap 2
  stack card grow align center
    "Mum" bold
    a big
    button "+1" tap add point team = Mum, pts = 1
    row gap 1
      button "+10" tap add point team = Mum, pts = 10
  stack card grow align center
    "Dad" bold
    b big
    button "+1" tap add point team = Dad, pts = 1
    row gap 1
      button "+10" tap add point team = Dad, pts = 10
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Mum win!" head color good
if b >= winat
  "Dad win!" head color good
"Lead:" abs(a - b) faint
```
Answer:
```
replace 19-20
+ section "Controls"
+   button "Undo" tap remove last(point)
+   button "New game" tap remove all point
```

### v4-e-b1d41c852c
Request: put the top donation cards under a section called Raised

Before:
```
app "Helping Hands" heart teal
table donation donor text, amount money, project pick Water|Food|Education|Health = Food
table help project pick Water|Food|Education|Health = Food, people num 1..2000 = 25
table spend what text, amount money
setting goal money = 1500000 "Yearly fundraising goal"
let raised = sum(donation.amount year)
let used = sum(spend.amount year)
topbar donation, "Add donation"
statcard raised, "raised this year of" goal, goal
row gap 2
  stat used, "spent on projects"
  stat raised - used, "available"
  stat sum(help.people year), "people helped"
section "By project", "raised"
  share donation year by project, sum(it.amount), it.key
section "People helped", "by project"
  bars help by project, sum(it.people), it.key
section "Donations per month", "last 6 months"
  bars days last 6 months, sum(donation.amount month of it), monthname(it)
section "Spending", "this year"
  each spend top 3 as s empty "No spending recorded yet."
    row gap 2
      s.what bold grow
      s.amount faint
  form spend, "Add spending"
section "Record people helped"
  form help, "Save"
section "Latest donors"
  list donation top 5, "No donations yet. Add the first donor."
section "Raised per project", "this year"
  each options donation.project as v
    row gap 2
      v bold grow
      sum(donation.amount year where project = v) faint
      draw 100, 4 width 80
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(sum(donation.amount year where project = v) / 
```
Answer:
```
replace 9-13
+ section "Raised"
+   statcard raised, "raised this year of" goal, goal
+   row gap 2
+     stat used, "spent on projects"
+     stat raised - used, "available"
+     stat sum(help.people year), "people helped"
```

### v4-e-687ef3b143
Request: group the season card in a section called Season

Before:
```
app "Garden" tree green dark
table harvest crop pick Tomato|Chilli|Okra|Spinach|Mint|Other = Tomato, kg num 0.1..100 unit "kg", note text?
table sow crop text, day date = today, rows num 1..20 = 1
setting season_goal num = 50 "Season goal (kg)"
state d date = today
let season = sum(harvest.kg year)
topbar harvest, "Log harvest"
statcard round(season * 10) / 10, "kg harvested this year, goal" season_goal, season_goal
row gap 2
  statcard count(harvest month), "harvest days this month"
  statcard round(max(harvest.kg) * 10) / 10, "kg in the best harvest"
section "By crop", "this year"
  share harvest year by crop, sum(it.kg), it.key
section "Kilograms per day", "last 14 days"
  daybars last 14 days, sum(harvest.kg on it)
section "Harvest calendar"
  monthnav d
  calendar harvest, d
section "Sowing log", "what went into the ground"
  each sow top 5 as s empty "Nothing sown yet. Add each sowing so you know when to expect a harvest."
    row card gap 2 tap edit s swipe remove s
      s.crop bold grow
      s.rows "rows" s.day faint
  form sow, "Add sowing"
section "Days since last harvest"
  since(harvest) big
  "Streak" streak(harvest) "days" faint
section "Harvests"
  list harvest by day, "No harvest yet. Tap Log harvest when you pick the first tomato."
row gap 2
  statcard count(harvest week), "entries this week"
  statcard count(harvest prev week), "entries last week"
section "Totals", "all time"
  count(harvest) "entries so far" big
  "This year" count(harvest year) faint
  "
```
Answer:
```
replace 8-11
+ section "Season"
+   statcard round(season * 10) / 10, "kg harvested this year, goal" season_goal, season_goal
+   row gap 2
+     statcard count(harvest month), "harvest days this month"
+     statcard round(max(harvest.kg) * 10) / 10, "kg in the best harvest"
```

### v4-e-477f89223b
Request: group the quick buttons into a section called Quick sale

Before:
```
app "Juice Bar" cup orange
table sale drink pick Orange|Mango|Sugarcane|Carrot|Mix = Orange, price money = 150
setting target money = 12000 "Daily takings target"
state flavour pick Orange|Mango|Sugarcane|Carrot|Mix = Orange
"Juice Bar" head
choice flavour
quick sale, price, [100, 150, 200, 250]
button "Sell a" flavour "for 150" tap add sale drink = flavour, price = 150
statcard sum(sale.price today), "taken today of" target, target
row gap 2
  stat count(sale today), "glasses today"
  stat count(sale week), "glasses this week"
  stat round(sum(sale.price today) / max(count(sale today), 1)), "average per glass"
section "Takings", "last 7 days"
  goalbars last 7 days, sum(sale.price on it), target
section "Flavours", "glasses this week"
  share sale week by drink, count(it), it.key
section "Flavours today"
  each options sale.drink as f
    row gap 2
      f bold grow
      count(sale today where drink = f) faint
      draw 100, 4 width 70
        rect 0, 0, 100, 4 fill soft radius 2
        rect 0, 0, 100 * clamp(count(sale today where drink = f) / max(count(sale today), 1), 0, 1), 4 fill accent radius 2
section "Busy days", "last 5 weeks"
  heat last 35 days, count(sale on it), 40
list sale today, "No sales yet today. Tap a price when the first glass goes."
section "Best day", "this month"
  stat max(days month, sum(sale.price on it)), "taken in one day"
section "Totals", "this month"
  row gap 2
    stat count(sale month), "glasses"
    stat sum(sale.price month), "takings"
```
Answer:
```
replace 7-8
+ section "Quick sale"
+   quick sale, price, [100, 150, 200, 250]
+   button "Sell a" flavour "for 150" tap add sale drink = flavour, price = 150
```


## typo_short (13 rows)

### v4-c-34820d178c
Request: pakistan ke sab sheher ka mosam

```
ask "Molde apps cannot get live weather. Do you want a weather diary where you type the city, the temperature and the sky?" "Yes, a weather diary" "No, never mind"
```

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

### v4-c-6e7d30fa2b
Request: doodh wala hisab kitab

```
app "Doodh wala" milk teal
table doodh litres num 0.5..10 = 1
setting rate money = 220 "Doodh ka rate"
stat sum(doodh.litres month) * rate, "is mahine ka hisab"
form doodh, "Doodh aaya"
list doodh by day
```
Plan: # need: field litres, total, list

### v4-c-e44efe5cb6
Request: bijli ka bil trackar

```
app "Bijli bill" bolt yellow
table bill amount money, units num 0..9999
stat last(bill.amount), "pichla bill"
trend bill last 12 months sort at, it.amount
form bill, "Bill likho"
```
Plan: # need: field amount, field units, chart, total

### v4-c-8fd3d978b9
Request: daily namz remindr

```
app "Namaz" moon green
table namaz which pick Fajr|Zuhr|Asr|Maghrib|Isha = Fajr
remind "Namaz ka waqt" at 5:00, 13:00, 17:00, 19:00, 21:00
quick namaz, which, [Fajr, Zuhr, Asr, Maghrib, Isha]
streak(namaz) "din lagatar" big
```
Plan: # need: reminder
