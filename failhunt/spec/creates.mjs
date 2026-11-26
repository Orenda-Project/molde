// DATA_SPEC_r5 example pairs (creates). node creates.mjs > creates.jsonl ; node ../tools/validate_spec.mjs creates.jsonl
const P = [];
const add = (cls, id, request, program) => P.push({ class: cls, id, kind: 'create', request, program: program.trim() + '\n' });

// ---- C1 roman-urdu: the same good programs the model already writes for English, requested in Roman Urdu
add('roman_urdu', 'ru1', 'paani peene ka hisaab', `
app "Paani" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500, 750]
daybars last 7 days, sum(drink.ml on it)
list drink
`);
add('roman_urdu', 'ru2', 'bachon ki haziri lagane ka app', `
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
`);
add('roman_urdu', 'ru3', 'dukaan ka udhaar ka hisaab', `
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
`);
add('roman_urdu', 'ru4', 'dawai lene ka time yaad dilao', `
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
`);

// ---- C2 meaningful formulas (calculators that were nonsense)
add('calculator_semantics', 'cs1', 'age in days calculator', `
app "Age in days" calc ocean
setting born date = 2000-01-01 "Date of birth"
let days = today - born
"Days old" days big
"About" floor(days / 365) "years" faint
`);
add('calculator_semantics', 'cs2', 'unit converter for kilometres and miles', `
app "Km and miles" calc slate
state km num = 0
state mi num = 0
field km "Kilometres"
field mi "Miles"
"Kilometres in miles" round(km * 0.621371 * 100) / 100 big
"Miles in kilometres" round(mi * 1.609344 * 100) / 100 big
`);
add('calculator_semantics', 'cs3', 'discount calculator', `
app "Discount" calc ocean
state price money = 0
state off num = 20
field price "Price tag"
field off "Discount %"
let saved = price * off / 100
"You pay" round(price - saved) big
"You save" round(saved) faint
`);
add('calculator_semantics', 'cs4', 'simple calculator', `
app "Calculator" calc mint
state a num = 0
state b num = 0
state op pick Add|Subtract|Multiply|Divide = Add
field a "First number"
choice op
field b "Second number"
let r = if(op = Add, a + b, if(op = Subtract, a - b, if(op = Multiply, a * b, a / b)))
"Result" round(r * 100) / 100 big
`);

// ---- C3 explicit specifics kept (unit, number, named options, named fields)
add('keep_specifics', 'ks1', 'track how many glasses of water i drink each day', `
app "Glasses" drop ocean
table drink glasses num 1..20 unit "glasses"
setting goal num = 8 "Daily goal (glasses)"
goal sum(drink.glasses today), goal, "today", "glasses"
quick drink, glasses, [1, 2]
daybars last 7 days, sum(drink.glasses on it)
list drink
`);
add('keep_specifics', 'ks2', 'a mood diary where i pick how i feel', `
app "Mood" smile ink
table entry mood pick Happy|Ok|Sad|Angry = Ok, note text?
share entry month by mood, count(it), it.key
form entry, "Add mood"
list entry by day
`);
add('keep_specifics', 'ks3', 'daily petrol log with litres, price per litre, odometer and a calculated mileage per litre and monthly cost', `
app "Petrol" car slate
table refuel litres num 1..200, price money, odo num 0..2000000 "Odometer"
let km = max(refuel.odo) - min(refuel.odo)
"Cost this month" sum(refuel month, it.litres * it.price) big
"Mileage" round(km / max(sum(refuel.litres), 1) * 10) / 10 "km per litre" faint
form refuel, "Add refuel"
list refuel by day
`);
add('keep_specifics', 'ks4', 'habit tracker for five habits: prayer, reading, exercise, water and sleep before 11, with a streak and a weekly view', `
app "Five habits" check mint
table tick what pick Prayer|Reading|Exercise|Water|Sleep_before_11
each options tick.what as h
  row card gap 2
    h bold grow
    streak(tick where what = h) "day streak" faint
    count(tick week where what = h) "this week" faint
    button "Done today" tap add tick what = h
heat last 70 days, count(tick on it), 5
`);

// ---- C4 typed programs for the shapes that failed the checker most (E_TYPE): dice, committee, tic-tac-toe style state
add('checker_shapes', 'ck1', 'a dice roller', `
app "Dice" dice plum
state roll num = 1
draw 100, 100 width 160 tap set roll = random(6)
  rect 4, 4, 92, 92 radius 16 fill soft stroke ink thick 2
  label 50, 54, roll big
button "Roll again" tap set roll = random(6)
`);
add('checker_shapes', 'ck2', 'committee or bc tracker with 12 members, monthly amount 5000, tick who has paid this month and total collected', `
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
`);
add('checker_shapes', 'ck3', 'a tip calculator for dining out', `
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
`);

// ---- C5 unsupported: closest offline app, honest labels
add('unsupported_offline', 'un1', 'live cricket scores from the internet', `
app "Score sheet" ball ocean
table score runs num 0..999, wickets num 0..10, overs num 0..50
last(score.runs) "/" last(score.wickets) big
"Type the score by hand: Molde apps work without the internet." faint
form score, "Update score"
list score by day
`);
add('unsupported_offline', 'un2', 'scan receipts with the camera and read the amounts', `
app "Receipts" list slate
table receipt amount money, shop text?, photo image?
"This month" sum(receipt.amount month) big
"Add the picture and type the amount." faint
form receipt, "Add receipt"
list receipt by day
`);
add('unsupported_offline', 'un3', 'gps tracker for my bike rides on a map', `
app "Bike rides" bike ocean
table ride km num 0.1..300, mins num 1..900, route text?
stat sum(ride.km week), "km this week"
"Molde cannot read GPS: type the distance after each ride." faint
form ride, "Add ride"
daybars last 7 days, sum(ride.km on it)
list ride by day
`);

// ---- C6 labels match the topic (leaked labels like "Log study time" in an attendance app)
add('label_leak', 'll1', 'attendance sheet for my class', `
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
`);
add('label_leak', 'll2', 'record student marks and show the class average', `
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
`);

add('label_leak', 'll3', 'school lunch planner', `
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
`);

// ---- C7 richer than 4 lines when the request lists needs
add('not_thin', 'nt1', 'pocket money tracker for my kids', `
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
`);
add('not_thin', 'nt2', 'savings', `
app "Savings" coin mint
table deposit amount money 10..1000000
setting goal money = 100000 "Savings goal"
goal sum(deposit.amount), goal, "saved so far"
quick deposit, amount, [1000, 5000, 10000]
form deposit
list deposit by day
`);
add('not_thin', 'nt3', 'a simple khata for my customers', `
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
`);

// ---- C8 realistic numbers
add('realistic_numbers', 'rn1', 'how many hours i studied today', `
app "Study hours" school ocean
table study subject text?, mins num 1..600
setting goal num = 3 "Daily goal (hours)"
goal sum(study.mins today) / 60, goal, "hours today", "h"
quick study, mins, [30, 60, 90]
form study
daybars last 7 days, sum(study.mins on it) / 60
list study by day
`);
add('realistic_numbers', 'rn2', 'baby feeding', `
app "Baby feeds" baby mint
table feed ml num 10..300 unit "ml"
stat sum(feed.ml today), "ml today"
stat count(feed today), "feeds today"
quick feed, ml, [60, 90, 120]
form feed
daybars last 7 days, sum(feed.ml on it)
list feed by day
`);
add('realistic_numbers', 'rn3', 'a step counter log with a weekly goal', `
app "Weekly steps" walk mint
table walk steps num 100..100000 unit "steps"
setting goal num = 70000 "Weekly goal (steps)"
goal sum(walk.steps week), goal, "this week", "steps"
quick walk, steps, [1000, 2000, 5000]
form walk
daybars last 7 days, sum(walk.steps on it)
list walk
`);

// ---- C9 typos and short names
add('typo_short', 'ty1', 'sals report', `
app "Sales report" chart slate
table sale item text, amount money
stat sum(sale.amount today), "today"
stat sum(sale.amount month), "this month"
form sale, "Add sale"
daybars last 7 days, sum(sale.amount on it)
list sale by day
`);
add('typo_short', 'ty2', 'medecine reminder', `
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
`);
add('typo_short', 'ty3', 'expence tracker', `
app "Expenses" wallet mint
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
stat sum(spend.amount month), "this month"
form spend, "Add expense"
share spend month by category, sum(it.amount), it.key
list spend by day
`);
// ---- lever 3: minimal pairs (same topic, different specifics, different programs)
add('minimal_pairs', 'mp1a', 'a water tracker with a daily goal of 2500 ml and quick buttons for a glass and a bottle', `
app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2500 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500]
list drink
`);
add('minimal_pairs', 'mp1b', 'a water tracker that counts glasses with a goal of 8 a day and a chart of the week', `
app "Glasses" drop ocean
table drink glasses num 1..20 unit "glasses"
setting goal num = 8 "Daily goal (glasses)"
goal sum(drink.glasses today), goal, "today", "glasses"
quick drink, glasses, [1, 2]
daybars last 7 days, sum(drink.glasses on it)
`);
add('minimal_pairs', 'mp2a', 'expense tracker with categories food, rent and travel and a chart per category', `
app "Expenses" wallet mint
table spend what text, amount money, category pick Food|Rent|Travel = Food
stat sum(spend.amount month), "this month"
share spend month by category, sum(it.amount), it.key
form spend, "Add expense"
list spend by day
`);
add('minimal_pairs', 'mp2b', 'expense tracker where i write who paid, no categories', `
app "Expenses" wallet mint
table spend what text, amount money, who text
stat sum(spend.amount month), "this month"
form spend, "Add expense"
list spend by day
`);
// ---- lever 6: "cannot do that yet" through the existing ask line (needs the app capability list to allow ask for these requests)
add('refusal_ask', 'rq1', 'gps tracker for my bike rides on a map', `
ask "Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?" "Yes, a ride log" "No, never mind"
`);
add('refusal_ask', 'rq2', 'an app that sends whatsapp reminders to my customers', `
ask "Molde apps cannot send messages. Do you want a customer list with a reminder on your own phone?" "Yes, customer list and reminder" "No, never mind"
`);
add('refusal_ask', 'rq3', 'live cricket scores from the internet', `
ask "Molde apps work without the internet, so they cannot fetch scores. Do you want a score sheet you fill in?" "Yes, a score sheet" "No, never mind"
`);
add('refusal_ask', 'rq4', 'gps tracker for my bike rides on a map\nQuestion: Molde apps cannot use GPS or a map. Do you want a ride log where you type the distance?\nAnswer: Yes, a ride log', `
app "Bike rides" bike ocean
table ride km num 0.1..300, mins num 1..900, route text?
stat sum(ride.km week), "km this week"
form ride, "Add ride"
daybars last 7 days, sum(ride.km on it)
list ride by day
`);
for (const p of P) console.log(JSON.stringify(p));
