# 40 random pairs

## 1. create | real:oos | hurried | real | 82 tokens

**Request:** baby growth, snap the baby with camera

Target program:
```
app "Baby growth" baby ocean
table growth kg num 1..30, cm num 30..130, memo text?
stat last(growth.kg), "latest"
form growth
trend growth last 90 days sort at, it.kg
list growth by day
remind "Time to add baby's growth" at 21:00
```

## 2. create | v1:mutate:theme | multi_feature | wedding_planning | 227 tokens

**Request:** wedding planner: guest list with RSVP, budget per function, vendor contacts, and checklist of tasks with due dates, make it green.

Target program:
```
app "Wedding Planner" gift mint
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

## 3. create | real:create | fuller | real | 96 tokens

**Request:** My kids keep asking for money, so I need a daily goal of 1000 with a progress bar, a big average of what they save over 30 days.

Target program:
```
app "Pocket money" coin ocean
table saved amount money 10..100000, note text?
setting goal money = 1000 "Daily goal"
screen main "Today" home
  goal sum(saved.amount today), goal, "today"
  stat round(avg(saved.amount last 30 days)), "average entry, last 30 days"
  form saved
screen past "History" chart
  list saved
```

## 4. edit | real:edit | fuller | real | 90 tokens

**Request:** 65 km is the number I want each day now, up from fifty. Could you change the daily goal to that and keep the ride log and the history page as they are.

Program before:
```
app "Cycling" bike ink
table ride km num 0.5..200 unit "km"
setting goal num = 50 "Daily goal (km)"
screen main "Today" home
  goal sum(ride.km today), goal, "today"
  form ride
screen past "History" chart
  trend days last 14 days, sum(ride.km on it)
  list ride by day
```

Target program:
```
app "Cycling" bike ink
table ride km num 0.5..200 unit "km"
setting goal num = 65 "Daily goal (km)"
screen main "Today" home
  goal sum(ride.km today), goal, "today"
  form ride
screen past "History" chart
  trend days last 14 days, sum(ride.km on it)
  list ride by day
```

## 5. create | real:create | fuller | real | 58 tokens

**Request:** Days since my last book entry is the first number I want to see, then a form to add a book and a list of my books where I can tap to edit or swipe to remove one.

Target program:
```
app "Book list" book ink
table book title text, author text?, pages num 1..3000, rating num 1..5, finished bool, memo text?
stat since(book), "days since the last entry"
form book
list book
```

## 6. create | v1:mutate:theme | typos | jewelry_gold | 166 tokens

**Request:** gold jewelry stock for my shop, weight in tola, purchase price, and sale price. Colour: dark and moody.

Target program:
```
app "Gold stock" coin ink
table piece name text, tola num 0.., bought money, price money, sold bool
count(piece where sold = no) "pieces in stock," sum(piece.tola where sold = no) "tola" head
"Stock cost" sum(piece.bought where sold = no) "Profit on sold" sum(piece where sold = yes, it.price - it.bought) faint
each piece where sold = no sort at as p
  row card tap edit p swipe remove p
    stack grow
      p.name bold
      p.tola "tola, bought" p.bought "ask" p.price faint
    button "Sold" tap set p.sold = yes
form piece
"Sold" head
list piece where sold = yes
```

## 7. create | real:create | fuller | real | 125 tokens

**Request:** I keep overcooking them, so I need an eight minute boil timer that logs an egg when done, a five minute rest timer, and eggs today against a goal of three.

Target program:
```
app "Egg timer" food mint
table egg_done
setting length dur = 8m "Boil length"
setting target num = 3 "Daily goal"
timer length, "Boil", add egg_done then notify "Boil done"
count(egg_done today) "today" head
stat streak(egg_done), "day streak"
goal count(egg_done today), target, "today", "done"
timer 5m, "Rest"
list egg_done today
remind "Time for egg timer" at 8:00, 20:00
```

## 8. create | real:create | fuller | real | 73 tokens

**Request:** Show a big count of this month's care and the days since the last one, then a way to log Water, Feed, Prune or Repot. Add a bar chart of the last seven days below.

Target program:
```
app "Plant care" plant ink
table care plant text, action pick Water|Feed|Prune|Repot = Water, note text?
stat count(care month), "this month"
stat since(care), "days since the last entry"
form care
daybars last 7 days, count(care on it)
list care by day
```

## 9. create | real:create | fuller | real | 39 tokens

**Request:** A list of my meals with grams to edit or swipe away. A big day streak number shows how many days in a row I have logged a meal. A way to add a meal with its grams.

Target program:
```
app "Protein" food ocean
table meal grams num 1..300 unit "g"
stat streak(meal), "day streak"
form meal
list meal
```

## 10. create | hand2 | vague | b5_pen_letters | 123 tokens

**Request:** pen friends and letters sent and received

Target program:
```
app "Letters" note plum
table friend name text, country text?
table letter friend ref friend, direction pick Sent|Received = Sent
each friend sort name as f
  row card tap edit f
    f.name bold grow
    count(f.letter where direction = Sent) "sent" faint
    count(f.letter where direction = Received) "got" faint
    if(count(f.letter where direction = Received) > count(f.letter where direction = Sent), "your turn", "") color warn
form letter, "Add letter"
form friend, "Add friend"
```

## 11. create | v1:template:todo | vague | g_Moving house | 100 tokens

**Request:** good morning, we are moving next month. What can you build?

Target program:
```
app "Moving house" home mint
table move_task title text, done bool, tag pick Pack|Utilities|Paperwork|Clean = Pack
count(move_task where done = no) "open" head
each move_task where done = no as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      t.title bold
      t.tag faint
form move_task
"Done" faint
list move_task where done = yes
```

## 12. create | real:create | hurried | real | 121 tokens

**Request:** i forget my dreams by morning

Target program:
```
app "Dream journal" moon slate
table dream title text, story long, vivid num 1..5, memo text?
screen main "Add" plus
  stat since(dream), "days since the last entry"
  stat round(avg(dream.vivid last 30 days) * 10) / 10, "average, last 30 days"
  form dream
screen charts "Charts" chart
  trend dream last 30 days sort at, it.vivid
  list dream
remind "Time to add dreams" at 22:00
```

## 13. edit | real:edit | fuller | real | 154 tokens

**Request:** Each homework item could take an optional note, so I can jot the page numbers for the late ones.

Program before:
```
app "Homework" pencil ocean
table hw subject pick Maths|English|Urdu|Science|Islamiat|Other = Maths, task text, due date, done bool
let late = count(hw where done = no and due < today)
remind "Homework is due tomorrow" at hw.due - 1d at 17:00
"Late" late big color if(late > 0, bad, good)
each hw where done = no sort due as h
  row card gap 1 tap edit h
    stack grow
      h.subject bold
      h.task faint
    h.due color if(h.due < today, bad, muted)
    toggle h.done
form hw
```

Target program:
```
app "Homework" pencil ocean
table hw subject pick Maths|English|Urdu|Science|Islamiat|Other = Maths, task text, due date, done bool, note text?
let late = count(hw where done = no and due < today)
remind "Homework is due tomorrow" at hw.due - 1d at 17:00
"Late" late big color if(late > 0, bad, good)
each hw where done = no sort due as h
  row card gap 1 tap edit h
    stack grow
      h.subject bold
      h.task faint
    h.due color if(h.due < today, bad, muted)
    toggle h.done
form hw
```

## 14. create | v1:hand-oos | detailed | a1_nutritionist_oos | 66 tokens

**Request:** Chat with an AI nutritionist that makes my diet plan, and I also want to log my meals and calories

Target program:
```
app "Meals" apple mint
table meal item text, kcal num 0..3000
setting goal num = 2000 "Calories a day"
goal sum(meal.kcal today), goal, "kcal today"
form meal
list meal last 7 days by day
```

## 15. create | v1:hand | typos | a3_t_water | 93 tokens

**Request:** water remindr and glass counter plz

Target program:
```
app "Water" drop ocean
table sip ml num 50..1500
setting goal num = 2000 "Daily goal (ml)"
remind "Drink water" every 2h from 9:00 to 21:00
goal sum(sip.ml today), goal, "ml today"
quick sip, ml, [250, 500]
list sip today
```

## 16. create | real:create | fuller | real | 384 tokens

**Request:** For a student with a weekly timetable, lessons sit under each day with a start time and length, and a Focus timer that logs studied minutes. A Cards page flips through flashcards too.

Target program:
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

## 17. create | v1:template:quantity | detailed | q_Cigarettes | 81 tokens

**Request:** listen, keep a record of the cigarettes I smoke. Add a daily limit of 5 cigs, a history grouped by day, a bar chart of the last 7 days and space for a short note with every entry

Target program:
```
app "Cigarettes" fire ocean
table smoke count num 1..20 unit "cigs", note text?
setting goal num = 5 "Daily limit (cigs)"
goal sum(smoke.count today), goal, "today", "cigs"
form smoke
daybars last 7 days, sum(smoke.count on it)
list smoke by day
```

## 18. edit | real:edit | fuller | real | 116 tokens

**Request:** The minutes goal and the average over the last 30 days are fine, so please add a day streak for my workouts that counts how many days in a row I have logged one.

Program before:
```
app "Gym time" dumbbell plum
table workout mins num 10..240 unit "min"
setting goal num = 180 "Daily goal (min)"
stat round(avg(workout.mins last 30 days)), "average entry, last 30 days"
goal sum(workout.mins today), goal, "today"
form workout
heat last 70 days, sum(workout.mins on it), 180
list workout
```

Target program:
```
app "Gym time" dumbbell plum
table workout mins num 10..240 unit "min"
setting goal num = 180 "Daily goal (min)"
stat round(avg(workout.mins last 30 days)), "average entry, last 30 days"
goal sum(workout.mins today), goal, "today"
stat streak(workout), "day streak"
form workout
heat last 70 days, sum(workout.mins on it), 180
list workout
```

## 19. create | v1:template:ringcounter | typos | h_b_Dentist floss | 147 tokens

**Request:** listen, pleease count my flossiing with one big tap that lso has a big circle I tap to add a floss with a ring that fills up to 7 new rounds each time it reaches the target with the round number shown a reset button for the day and a small weekly chart below

Target program:
```
app "Dentist floss" tooth ocean
table floss
setting target num = 7 "Count to"
let n = count(floss today)
draw width 240 tap add floss
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
  label 50, 64, "Round" floor(n / target) + 1 faint
button "Reset today" tap remove all floss today
daybars last 7 days, count(floss on it)
```

## 20. create | v1:hand | multi_feature | m_recipe_scaler | 137 tokens

**Request:** recipe scaler: type how many people the recipe is for and how many I am cooking for, and it shows the multiplier and the amounts for rice 2 cups, oil 3 spoons, salt 1 spoon

Target program:
```
app "Recipe scaler" food mint
state orig num = 4
state cook num = 6
field orig "Recipe is for"
field cook "I am cooking for"
let k = cook / max(orig, 1)
"Multiply by" round(k * 100) / 100 big
"Rice" round(2 * k * 10) / 10 "cups" bold
"Oil" round(3 * k * 10) / 10 "spoons" bold
"Salt" round(1 * k * 10) / 10 "spoon" bold
```

## 21. edit | real:edit | hurried | real | 102 tokens

**Request:** habits drop the day streak

Program before:
```
app "Habits" check ocean
table habit name text, part pick Morning|Afternoon|Evening = Morning
table check habit ref habit
let n = count(habit)
count(check today) "of" n "done today" head
each habit
  row card gap 2 tap edit it swipe remove it
    stack grow
      it.name bold
      streak(it.check) "day streak" faint
      it.part faint
    toggle it.check
form habit
heat last 70 days, count(check on it), n
```

Target program:
```
app "Habits" check ocean
table habit name text, part pick Morning|Afternoon|Evening = Morning
table check habit ref habit
let n = count(habit)
count(check today) "of" n "done today" head
each habit
  row card gap 2 tap edit it swipe remove it
    stack grow
      it.name bold
      it.part faint
    toggle it.check
form habit
heat last 70 days, count(check on it), n
```

## 22. edit | real:edit | fuller | real | 72 tokens

**Request:** I forget to add gratitude in the morning and at night, so a reminder at 8:00 and 20:00 saying Time to add gratitude would help. The days since the last entry line stays.

Program before:
```
app "Gratitude" heart ink
table thanks thing text, person text?
screen main "Add" plus
  stat since(thanks), "days since the last entry"
  form thanks
screen charts "Charts" chart
  list thanks by day
```

Target program:
```
app "Gratitude" heart ink
table thanks thing text, person text?
screen main "Add" plus
  stat since(thanks), "days since the last entry"
  form thanks
screen charts "Charts" chart
  list thanks by day
remind "Time to add gratitude" at 8:00, 20:00
```

## 23. create | real:create | fuller | real | 79 tokens

**Request:** I am scared of overspending each week, so I need this week's total in a big number, bars for food, bills, travel, fun and other, and a list by day to fix a mistake.

Target program:
```
app "Weekly spend" wallet slate
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Food
"This week" sum(spend.amount week) big
share spend week by category, sum(it.amount), it.key
daybars last 7 days, sum(spend.amount on it)
form spend
list spend week by day
```

## 24. create | real:create | hurried | real | 121 tokens

**Request:** how much did i make on fish today?

Target program:
```
app "Fish stall" fish ocean
table buy kg num 1..500, cost money
table sell kg num 0.. = 1, price money
let left = sum(buy.kg today) - sum(sell.kg today)
"Left unsold" left "kg" big color if(left < 0, bad, ink)
"Made today" sum(sell.price today) - sum(buy.cost today) bold
form buy, "Bought"
form sell, "Sold"
daybars last 7 days, sum(sell.price on it)
```

## 25. create | hand2 | detailed | b5_tutor_topics | 140 tokens

**Request:** I tutor 6 kids. each has topics to cover; I tick which topics each kid covered. show a progress bar per kid and the topics nobody has covered yet

Target program:
```
app "Tutor Map" school mint
table kid name text
table topic name text
table covered kid ref kid, topic ref topic
each kid sort name as k
  stack card gap 1
    k.name bold
    goal count(k.covered), count(topic), "topics covered"
each topic sort name as t
  row
    t.name grow
    if(count(t.covered) = 0, "nobody yet", join(count(t.covered), " kids")) faint color if(count(t.covered) = 0, warn, muted)
form covered, "Mark covered"
form kid, "Add kid"
form topic, "Add topic"
```

## 26. create | real:create | hurried | real | 40 tokens

**Request:** coffee run counter log button

Target program:
```
app "Coffee runs" coffee mint
table run_out
screen main "Today" home
  button "Log run" tap add run_out
screen past "History" chart
  list run_out
```

## 27. create | real:create | fuller | real | 99 tokens

**Request:** Top of the page shows Over budget by or Left to spend against my monthly budget of 10000, then a bar for money spent, and a box to add each cost with its category.

Target program:
```
app "Hobby spending" pencil ocean
table hobby_cost what text, amount money, category pick Gear|Courses|Materials|Events|Other
let spent = sum(hobby_cost.amount month)
setting budget money = 10000 "Monthly budget"
if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
form hobby_cost
list hobby_cost month by day
```

## 28. create | hand2-oos | detailed | b2_oos_ai_diet | 69 tokens

**Request:** Write me a weekly diet plan with AI based on my weight and goal and then let me log what I actually ate and the calories against a daily limit.

Target program:
```
app "Calorie log" food mint
table meal what text, kcal num 0..3000
setting limit num 800..5000 = 1800 "Daily calories"
goal sum(meal.kcal today), limit, "kcal today"
form meal
list meal today
```

## 29. create | v1:hand | short | a3_memory_pairs | 107 tokens

**Request:** memory match with shuffled cards

Target program:
```
app "Match" brain plum
table sym name text
table open s ref sym
state a num = 0
each sym shuffle as s
  box height 54 radius 10 fill if(count(s.open) > 0, accent, soft) tap toggle s.open
    if(count(s.open) > 0, s.name, "?") big align center
"Open cards" count(open all) faint
button "Close all" tap remove all open
form sym, "Add symbol"
```

## 30. create | real:create | hurried | real | 185 tokens

**Request:** money habits, daily ticks and streaks

Target program:
```
app "Money habits" wallet ocean
table money_rule name text
table money_rule_done money_rule ref money_rule
let n = count(money_rule)
screen main "Today" check
  count(money_rule_done today) "of" n "done today" head
  each money_rule
    row card gap 2 tap edit it swipe remove it
      stack grow
        it.name bold
        streak(it.money_rule_done) "day streak" faint
      toggle it.money_rule_done
  form money_rule
screen stats "Stats" chart
  stat round(count(money_rule_done week) * 100 / (n * weekday(today))), "% done this week"
  stat max(money_rule, streak(it.money_rule_done)), "best streak"
  stat round(count(money_rule_done last 30 days) * 100 / (n * 30)), "% in 30 days"
```

## 31. create | real:create | hurried | real | 78 tokens

**Request:** things expiring warranty in 30 days

Target program:
```
app "Home Inventory Buddy" home slate
table thing item text, room text, bought date, warranty date
remind "Warranty ends" at thing.warranty
each thing where warranty - today <= 30 and warranty >= today sort warranty
  row card
    it.item "- warranty ends" it.warranty color warn
form thing, "Add item"
list thing
```

## 32. edit | real:edit | fuller | real | 223 tokens

**Request:** A first to 21 finish is how we play, so I want the win message to appear when a side reaches 21. Keep the plus one and plus two buttons, plus Undo and New game.

Program before:
```
app "Ping pong" ball plum
table point team pick Left|Right, pts num 1..500 = 1
let a = sum(point.pts where team = Left)
let b = sum(point.pts where team = Right)
row gap 2
  stack card grow align center
    "Left" bold
    a big
    button "+1" tap add point team = Left, pts = 1
    row gap 1
      button "+2" tap add point team = Left, pts = 2
  stack card grow align center
    "Right" bold
    b big
    button "+1" tap add point team = Right, pts = 1
    row gap 1
      button "+2" tap add point team = Right, pts = 2
button "Undo" tap remove last(point)
button "New game" tap remove all point
```

Target program:
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
  stack card grow align center
    "Right" bold
    b big
    button "+1" tap add point team = Right, pts = 1
    row gap 1
      button "+2" tap add point team = Right, pts = 2
button "Undo" tap remove last(point)
button "New game" tap remove all point
if a >= winat
  "Left win!" head color good
if b >= winat
  "Right win!" head color good
```

## 33. create | real:ask | fuller | real | 23 tokens

**Request:** I am working on getting better at a few things and I want to see the numbers going up over the weeks

Target program:
```
ask "Progress in what?" "Exercise" "Study" "Weight" "A skill I am learning"
```

## 34. edit | real:edit | fuller | real | 127 tokens

**Request:** One more thing for my tasks: some need a bit of context, so please add a note to each task. Old tasks can just be blank, and the list should look the same otherwise.

Program before:
```
app "Tasks" list ink
table task title text, status pick Todo|Doing|Blocked|Done = Todo, due date?
state show pick All|Todo|Doing|Blocked|Done = All
choice show
each task where show = All or status = show sort due as t
  stack card gap 1 tap edit t swipe remove t
    row gap 1
      t.title bold grow
      t.due faint color if(t.due < today, bad, muted)
    choice t.status
count(task where status != Done) "open tasks" faint
form task
```

Target program:
```
app "Tasks" list ink
table task title text, status pick Todo|Doing|Blocked|Done = Todo, due date?, note text?
state show pick All|Todo|Doing|Blocked|Done = All
choice show
each task where show = All or status = show sort due as t
  stack card gap 1 tap edit t swipe remove t
    row gap 1
      t.title bold grow
      t.due faint color if(t.due < today, bad, muted)
    choice t.status
count(task where status != Done) "open tasks" faint
form task
```

## 35. edit | real:edit | fuller | real | 177 tokens

**Request:** Each rent entry should let me pick a due date, and I'm happy to leave it empty if there isn't one. The Rent owed total at the top should still be the same sum.

Program before:
```
app "Rent" home slate
table tenant name text, phone text?
table rent_entry tenant ref tenant, amount money, kind pick Due|Paid, note text?
"Rent owed" sum(rent_entry.amount where kind = Due) - sum(rent_entry.amount where kind = Paid) big
each tenant as p
  let bal = sum(p.rent_entry.amount where kind = Due) - sum(p.rent_entry.amount where kind = Paid)
  stack card tap edit p
    row
      p.name bold grow
      if(bal >= 0, "owes you", "paid ahead") abs(bal) color if(bal >= 0, good, bad)
    "Last entry" last(p.rent_entry.at) faint
form tenant, "Add tenant"
form rent_entry, "Add entry"
list rent_entry by day
```

Target program:
```
app "Rent" home slate
table tenant name text, phone text?
table rent_entry tenant ref tenant, amount money, kind pick Due|Paid, due date?, note text?
"Rent owed" sum(rent_entry.amount where kind = Due) - sum(rent_entry.amount where kind = Paid) big
each tenant as p
  let bal = sum(p.rent_entry.amount where kind = Due) - sum(p.rent_entry.amount where kind = Paid)
  stack card tap edit p
    row
      p.name bold grow
      if(bal >= 0, "owes you", "paid ahead") abs(bal) color if(bal >= 0, good, bad)
    "Last entry" last(p.rent_entry.at) faint
form tenant, "Add tenant"
form rent_entry, "Add entry"
list rent_entry by day
```

## 36. create | real:create | hurried | real | 102 tokens

**Request:** my charity giving today with a daily goal of 5000

Target program:
```
app "Charity" gift slate
table donation amount money 10..1000000, note text?
setting goal money = 5000 "Daily goal"
screen main "Today" home
  goal sum(donation.amount today), goal, "today"
  stat streak(donation), "day streak"
  form donation
screen past "History" chart
  trend days last 14 days, sum(donation.amount on it)
  list donation
```

## 37. create | real:create | fuller | real | 86 tokens

**Request:** I never know where grocery money goes, so each buy gets a category, and I see this month against last.

Target program:
```
app "Groceries" cart plum
table buy what text, amount money, category pick Veg|Meat|Dairy|Pantry|Snacks
let spent = sum(buy.amount month)
"Spent" spent big
"Last month" sum(buy.amount prev month) faint
form buy
list buy month by day
remind "Add today's expenses" at 22:00
```

## 38. create | real:create | hurried | real | 170 tokens

**Request:** pocket money spent vs budget 3000 pls

Target program:
```
app "Pocket money" coin ink
table pocket what text, amount money, category pick Snacks|Games|Books|Gifts|Other
state m date = today
let spent = sum(pocket.amount month of m)
setting budget money = 3000 "Monthly budget"
monthnav m
"Safe to spend" round(max(budget - spent, 0) / (monthdays(today) - monthday(today) + 1)) "a day" faint
if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
form pocket
share pocket month of m by category, sum(it.amount), it.key
daybars last 7 days, sum(pocket.amount on it)
list pocket month of m by day
```

## 39. create | real:create | fuller | real | 182 tokens

**Request:** Between sets I need a rest, so I tap 60s or 90s and a countdown runs, with a Stop button and a Rest over notice when it ends.

Target program:
```
app "Gym rest" dumbbell ink
table setx lift text, reps num 1..50, kg num 0..300
state left dur = 60s
state go bool = no
every 1s if go set left = left - 1s
when go and left <= 0s set go = no then notify "Rest over"
screen rest "Rest" timer
  left big
  row gap 1
    button "60s" tap set left = 60s then set go = yes
    button "90s" tap set left = 90s then set go = yes
    button "Stop" tap set go = no
screen sets "Sets" dumbbell
  "Sets today" count(setx today) big
  form setx, "Log set"
  list setx today by day
```

## 40. create | real:create | fuller | real | 66 tokens

**Request:** For an imam who reads with a notebook, the page log asks for a title, minutes from 1 to 600 and pages from 1 to 500, showing this month's total pages in big type with a seven day bar chart.

Target program:
```
app "Reading log" book ink
table page_log title text, mins num 1..600, pages num 1..500
stat sum(page_log.pages month), "this month"
form page_log
daybars last 7 days, sum(page_log.pages on it)
list page_log
```

