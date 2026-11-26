// DATA_SPEC_r5 example pairs (creates). Every request is new (tools/leak_check.mjs), every program has its own shape (tools/skeleton_check.mjs, cap 2).
// node creates.mjs > creates.jsonl
const P = [];
const add = (cls, id, request, program, plan) => P.push({ class: cls, id, kind: plan ? 'create_plan' : 'create', request, ...(plan ? { plan } : {}), program: program.trim() + '\n' });

// ---- roman_urdu: Roman Urdu or mixed requests, programs for the topic the words name
add('roman_urdu', 'ru1', 'chai ki dukaan ka rozana hisaab, kitne cup bike aur kitna paisa aaya', `
app "Chai hisaab" coffee orange
table cup kind pick Doodh_patti|Kadak|Green_tea = Doodh_patti, qty num 1..200 = 1, rate money
stat sum(cup today, it.qty * it.rate), "aaj ka paisa"
stat sum(cup.qty today), "aaj ke cup"
share cup week by kind, sum(it.qty), it.key
form cup, "Naya hisaab"
list cup by day
`, '# need: field cup, option doodh_patti/kadak/green_tea, field qty, field rate, total today, chart, list');
add('roman_urdu', 'ru2', 'gaon ki committee mein har banda mahine ka kitna deta hai aur kis ka baqi hai', `
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
`, '# need: field banda, field jama, setting hissa, total month, list');
add('roman_urdu', 'ru3', 'mere bachon ke school ki chhuttiyan aur kitne din gaye', `
app "Chhuttiyan" school ocean
table chhutti child pick Ali|Sara|Hamza = Ali, why text?, on date = today
count(chhutti month) "is mahine chhuttiyan" big
each options chhutti.child as c
  row card
    c bold grow
    count(chhutti month where child = c) "din" faint
form chhutti, "Chhutti likho"
list chhutti by day
`);

// ---- calculator_semantics: formulas that mean what they say
add('calculator_semantics', 'cs1', 'how many days until my exam', `
app "Exam days" hourglass ocean
setting exam date "Exam date"
let left = exam - today
if left > 0
  left "days to go" big
  floor(left / 7) "weeks and" left % 7 "days" faint
else
  "The exam day has come" head
`);
add('calculator_semantics', 'cs2', 'convert my weight between kilos and pounds', `
app "Kilos and pounds" scale slate
state kg num = 0
state lb num = 0
field kg "Kilograms"
field lb "Pounds"
"Kilograms in pounds" round(kg * 2.20462 * 10) / 10 big
"Pounds in kilograms" round(lb / 2.20462 * 10) / 10 big
`);
add('calculator_semantics', 'cs3', 'work out the price after a sale and sales tax', `
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
`);

// ---- keep_specifics: every named field, option, unit and number survives
add('keep_specifics', 'ks1', 'a log of my cycling rides: distance in km, time in minutes, and which bike, road or mountain', `
app "Rides" bike slate
table ride km num 0.5..300, mins num 5..900, bike pick Road|Mountain = Road
stat sum(ride.km week), "km this week"
stat round(sum(ride.km month) / max(sum(ride.mins month) / 60, 1) * 10) / 10, "average km per hour"
form ride, "Add ride"
list ride by day
`, '# need: field km, field mins, option road/mountain, total week, km per hour, list');
add('keep_specifics', 'ks2', 'a reading log where i give each book a star rating from 1 to 5 and see my best rated book', `
app "Books" book plum
table book title text, author text?, stars num 1..5
"Best rating" max(book.stars) "stars" big
each book sort stars desc as b
  row card tap edit b swipe remove b
    b.title bold grow
    b.stars "stars" faint
form book, "Add book"
`, '# need: field book, field stars, best rating, list');
add('keep_specifics', 'ks3', 'tuition fees for three students at 4000, 5000 and 6500 a month, with a tick when each has paid', `
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
`, '# need: option hira/zain/maha, field paid, field fee, total, list');

// ---- checker_shapes: typed shapes that fail often (choice + slider, ref sums, state machines)
add('checker_shapes', 'ck1', 'a spinner that picks a random student from my class list', `
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
`);
add('checker_shapes', 'ck2', 'a quiz with three questions where i tap an answer and see my score', `
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
`);
add('checker_shapes', 'ck3', 'a stopwatch that counts a workout and keeps the finished ones in a list', `
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
`);

// ---- unsupported_offline: the closest honest offline app, with the by-hand line
add('unsupported_offline', 'un1', 'show the weather forecast for my city', `
app "Weather notes" cloud ocean
table note day date = today, temp num -10..50, sky pick Sunny|Cloudy|Rain|Windy = Sunny
"Molde apps cannot fetch a forecast: write what you see outside." faint
form note, "Add today"
trend note last 30 days sort day, it.temp
list note by day
`, '# need: cannot forecast, field temp, option sunny/cloudy/rain/windy, trend, list');
add('unsupported_offline', 'un2', 'translate what i type from english to urdu', `
app "Word pairs" pen plum
table pair english text, urdu text
"Molde apps cannot translate: save the words you learn." faint
form pair, "Add a pair"
list pair
`);
add('unsupported_offline', 'un3', 'tell me when my parcel arrives using the courier website', `
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
`);

// ---- label_leak: every label comes from the request's own topic
add('label_leak', 'll1', 'who brought what to the family picnic', `
app "Picnic" food mint
table dish who text, what text, serves num 1..30 = 4
"People fed" sum(dish.serves) big
form dish, "Add a dish"
list dish
`);
add('label_leak', 'll2', 'my cricket club members and their match fees', `
app "Club fees" ball ocean
table member name text, fee money, paid bool
"Still to collect" sum(member.fee where paid = no) big
each member sort name as m
  row card gap 2 tap edit m
    toggle m.paid
    m.name bold grow
    m.fee faint
form member, "Add member"
`);
add('label_leak', 'll3', 'keep track of the plants i water and when', `
app "Plants" plant mint
table plant name text, every num 1..30 = 3 "Days between waterings"
table watered plant ref plant
each plant sort name as p
  row card gap 2
    p.name bold grow
    "last" last(p.watered.at) faint
    button "Watered" tap add watered plant = p
form plant, "Add plant"
`);

// ---- not_thin: what the request implies, nothing else
add('not_thin', 'nt1', 'the money my sister owes me and what she has paid back', `
app "Sister" wallet plum
table move kind pick Lent|Paid_back = Lent, amount money, note text?
"She still owes" sum(move.amount where kind = Lent) - sum(move.amount where kind = Paid_back) big
quick move, amount, [500, 1000, 5000]
form move, "Add entry"
list move by day
`);
add('not_thin', 'nt2', 'daily walk count', `
app "Steps" walk mint
table walk steps num 100..60000 unit "steps"
setting goal num = 8000 "Daily goal"
goal sum(walk.steps today), goal, "today", "steps"
quick walk, steps, [1000, 3000, 5000]
daybars last 7 days, sum(walk.steps on it)
list walk by day
`);
add('not_thin', 'nt3', 'monthly gas and electricity units', `
app "Utility units" bolt ocean
table reading kind pick Gas|Electricity = Electricity, units num 0..5000, cost money
bars reading month by kind, sum(it.units), it.key
stat sum(reading.cost month), "cost this month"
form reading, "Add reading"
list reading by day
`);

// ---- realistic_numbers: defaults from the unit, never from another app
add('realistic_numbers', 'rn1', 'daily goal for how long i read', `
app "Reading time" book plum
table sit mins num 5..300 unit "min"
setting goal num = 30 "Daily goal (min)"
goal sum(sit.mins today), goal, "today", "min"
quick sit, mins, [10, 20, 30]
list sit by day
`);
add('realistic_numbers', 'rn2', 'track how much i sleep each night, aim for eight hours', `
app "Sleep" bed ink
table night hours num 1..16
setting need num = 8 "Hours I aim for"
stat round(avg(night.hours last 7 days) * 10) / 10, "average this week"
goal last(night.hours), need, "last night", "h"
form night, "Add night"
trend night last 30 days sort at, it.hours
`);
add('realistic_numbers', 'rn3', 'body height and weight check', `
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
`);

// ---- typo_short: the program for the corrected request
add('typo_short', 'ty1', 'hoem budgat', `
app "Home budget" home slate
table spend what text, amount money, kind pick Food|Bills|School|Other = Food
setting limit money = 60000 "Monthly limit"
goal sum(spend.amount month), limit, "spent this month"
share spend month by kind, sum(it.amount), it.key
form spend, "Add spending"
list spend month by day
`, '# need: field spend, option food/bills/school/other, setting limit, chart, list');
add('typo_short', 'ty2', 'vacine remindr for my baby', `
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
`);
add('typo_short', 'ty3', 'wekly meel plan', `
app "Meals" food ocean
table meal day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, dish text
each options meal.day as d
  stack card gap 1
    d bold
    each meal where day = d as m
      row gap 1 tap edit m swipe remove m
        m.dish grow
form meal, "Plan a meal"
`);

// ---- minimal_pairs: same topic, different specifics, different programs
add('minimal_pairs', 'mp1a', 'a to do list where each job has a due date and the late ones are red', `
app "Jobs" list ink
table job title text, due date, done bool
count(job where done = no and due < today) "late" head color bad
each job where done = no sort due as j
  row card gap 2 tap edit j swipe remove j
    toggle j.done
    j.title grow
    j.due color if(j.due < today, bad, muted)
form job, "Add job"
`);
add('minimal_pairs', 'mp1b', 'a to do list where i give each job one of three levels and see the urgent ones first', `
app "Jobs" list slate
table job title text, level pick Low|Medium|Urgent = Medium, done bool
each job where done = no sort level desc as j
  row card gap 2 tap edit j swipe remove j
    toggle j.done
    j.title grow
    j.level color if(j.level = Urgent, bad, muted)
form job, "Add job"
`);
add('minimal_pairs', 'mp2a', 'split a holiday bill between four friends equally', `
app "Holiday split" users mint
state bill money = 0
state people num = 4
field bill "Total bill"
slider people 2..12
"Each pays" round(bill / max(people, 1)) big
`);
add('minimal_pairs', 'mp2b', 'split a holiday bill where each friend pays for what they ate', `
app "Who owes" users plum
table item who text, what text, price money
each item sort who as i
  row card gap 2 tap edit i swipe remove i
    i.who bold grow
    i.what faint
    i.price
"Total" sum(item.price) big
form item, "Add item"
`);

// ---- refusal_ask: plain English, says what the app can do instead (needs the app's capability list to allow ask)
add('refusal_ask', 'rq1', 'track my truck on a map while i drive', `
ask "Molde apps cannot use a map or GPS. Do you want a trip log where you type the distance after each drive?" "Yes, a trip log" "No, never mind"
`);
add('refusal_ask', 'rq2', 'remind my staff on whatsapp every morning', `
ask "Molde apps cannot send messages to other people. Do you want a staff list with a morning reminder on your own phone?" "Yes, staff list and reminder" "No, never mind"
`);
add('refusal_ask', 'rq3', 'track my truck on a map while i drive\nQuestion: Molde apps cannot use a map or GPS. Do you want a trip log where you type the distance after each drive?\nAnswer: Yes, a trip log', `
app "Truck trips" car slate
table drive km num 1..2000, from text?, to text?
stat sum(drive.km week), "km this week"
form drive, "Add trip"
daybars last 7 days, sum(drive.km on it)
list drive by day
`);
for (const p of P) console.log(JSON.stringify(p));
