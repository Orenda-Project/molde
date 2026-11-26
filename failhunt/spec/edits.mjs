// DATA_SPEC_r5 example pairs (edits). New wording for every request, a different base program per pair family (skeleton cap 2).
// node edits.mjs > edits.jsonl
const P = [];
const add = (cls, id, request, before, program) => P.push({ class: cls, id, kind: 'edit', request, before: before.trim() + '\n', program: program.trim() + '\n' });
const rep = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a); return s.replace(a, b); };
const B = {
gym: `
app "Gym" dumbbell ink
table lift exercise text, kg num 0..300, reps num 1..50
last(lift.kg) "kg last set" big
form lift, "Add set"
list lift by day
`,
rent: `
app "Rent" home slate
table tenant name text
table paid tenant ref tenant, amount money
setting rent money = 15000 "Monthly rent"
"Collected" sum(paid.amount month) big
each tenant sort name as t
  row card gap 2
    t.name bold grow
    if(sum(t.paid.amount month) >= rent, "Paid", "Due") color if(sum(t.paid.amount month) >= rent, good, bad)
form tenant, "Add tenant"
`,
tasbeeh: `
app "Tasbeeh" beads mint
table zikr
setting target num = 33 "Count to"
let n = count(zikr today)
draw width 240 tap add zikr
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
button "Undo" tap remove last(zikr today)
`,
birthdays: `
app "Birthdays" gift plum
table person name text, birthday date
each person sort monthday(birthday) as p
  row card tap edit p swipe remove p
    p.name bold grow
    p.birthday faint
form person, "Add person"
`,
spend: `
app "Spending" wallet mint
table spend what text, amount money, kind pick Food|Bills|Fun = Food
stat sum(spend.amount month), "this month"
share spend month by kind, sum(it.amount), it.key
form spend, "Add spending"
list spend month by day
`,
todo: `
app "Jobs" list slate
table job title text, done bool
stat count(job where done = no), "open"
each job where done = no as j
  row card gap 2 tap edit j swipe remove j
    toggle j.done
    j.title grow
form job, "Add job"
`,
weight: `
app "Weight" scale ocean
table weigh kg num 20..300
last(weigh.kg) "kg now" big
trend weigh last 60 days sort at, it.kg
form weigh, "Add weight"
list weigh by day
`,
medicine: `
app "Medicine" pill plum
table med name text, time time
table taken med ref med
remind "Time for medicine" at med.time
each med sort time as m
  row card gap 2
    m.name bold grow
    m.time faint
    toggle m.taken
form med, "Add medicine"
`,
habit: `
app "Habit" check ink
table tick
streak(tick) "day streak" big
weekdots count(tick on it) > 0
button "Done today" tap add tick
`,
timer: `
app "Focus" timer mint
table round topic text?
timer 25m, "Focus", add round then notify "Break"
count(round today) "rounds today" head
list round today
`,
stock: `
app "Stock" package slate
table item name text, qty num 0.., low num 0.. = 5
each item sort qty as i
  row card gap 1 tap edit i swipe remove i
    i.name bold grow
    button "-" tap set i.qty = i.qty - 1
    i.qty bold
    button "+" tap set i.qty = i.qty + 1
form item, "Add item"
`,
savings: `
app "Savings" coin mint
table deposit amount money
setting goal money = 100000 "Savings goal"
let p = clamp(sum(deposit.amount) / goal, 0, 1)
draw 100, 12
  rect 0, 0, 100, 12 fill soft radius 6
  rect 0, 0, 100 * p, 12 fill accent radius 6
round(p * 100) "% of" goal head
quick deposit, amount, [1000, 5000]
`,
books: `
app "Books" book plum
table book title text, author text?, pages num 1..3000, done bool
count(book where done = yes) "finished" big
each book sort title as b
  row card tap edit b swipe remove b
    toggle b.done
    b.title bold grow
    b.pages faint
form book, "Add book"
`,
sleep: `
app "Sleep" bed ink
table night slept time, woke time
let avg7 = sum(night last 7 days, (it.woke - it.slept)) / count(night last 7 days)
avg7 big
daybars last 7 days, sum(night on it, (it.woke - it.slept) / 1h)
form night, "Add night"
`,
pocket: `
app "Pocket money" coin mint
table kid name text
table move kid ref kid, amount money, kind pick Got|Spent = Got
each kid as k
  row card tap edit k
    k.name bold grow
    sum(k.move.amount where kind = Got) - sum(k.move.amount where kind = Spent) big
form kid, "Add child"
form move, "Add entry"
`,
poll: `
app "Vote" users ocean
table vote choice pick Pizza|Burger|Biryani = Pizza
bars vote by choice, count(it), it.key
form vote, "Vote"
`,
daily: `
app "Daily spend" wallet ink
table spend amount money, note text?
quick spend, amount, [100, 500, 1000]
stat sum(spend.amount today), "today"
stat sum(spend.amount month), "this month"
list spend by day
`,
water: `
app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500]
list drink
`,
shopcost: `
app "Shop costs" bag ocean
table cost what text, amount money, kind pick Milk|Gas|Wages = Milk
setting rent money = 15000 "Monthly rent"
let total = sum(cost.amount month) + rent
"This month" total big
each options cost.kind as k
  row card
    k bold grow
    sum(cost.amount month where kind = k) faint
form cost, "Add cost"
`,
};
// ---- add_field
add('add_field', 'af1', 'i want to note how hard each set felt', B.gym, rep(B.gym, 'reps num 1..50', 'reps num 1..50, effort num 1..10'));
add('add_field', 'af2', 'every job needs the name of who does it', B.todo, rep(B.todo, 'title text, done bool', 'title text, who text?, done bool'));
add('add_field', 'af3', 'keep the year each book came out', B.books, rep(B.books, 'pages num 1..3000, done bool', 'pages num 1..3000, year num 1000..2100, done bool'));
// ---- add_option
add('add_option', 'ao1', 'my gifts need their own heading', B.spend, rep(B.spend, 'Food|Bills|Fun = Food', 'Food|Bills|Fun|Gifts = Food'));
add('add_option', 'ao2', 'a fourth dish is coming: biryani is already there, so put in karahi', B.poll, rep(B.poll, 'Pizza|Burger|Biryani = Pizza', 'Pizza|Burger|Biryani|Karahi = Pizza'));
add('add_option', 'ao3', 'sometimes money comes back to a child as a refund', B.pocket, rep(B.pocket, 'Got|Spent = Got', 'Got|Spent|Refund = Got'));
// ---- remove_one
add('remove_one', 'rm1', 'i can do without the line graph', B.weight, rep(B.weight, 'trend weigh last 60 days sort at, it.kg\n', ''));
add('remove_one', 'rm2', 'take away the little week dots', B.habit, rep(B.habit, 'weekdots count(tick on it) > 0\n', ''));
add('remove_one', 'rm3', 'the long history underneath is too much', B.spend, rep(B.spend, 'list spend month by day\n', ''));
// ---- add_chart_stat
add('add_chart_stat', 'ac1', 'draw my weight lifted over time', B.gym, rep(B.gym, 'form lift, "Add set"', 'trend lift last 90 days sort at, it.kg\nform lift, "Add set"'));
add('add_chart_stat', 'ac2', 'how many of my pills did i take today', B.medicine, rep(B.medicine, 'form med, "Add medicine"', 'stat count(taken today), "taken today"\nform med, "Add medicine"'));
add('add_chart_stat', 'ac3', 'a bar per day for the focus rounds', B.timer, rep(B.timer, 'list round today', 'daybars last 7 days, count(round on it)\nlist round today'));
// ---- sections
add('sections', 'se1', 'give the screen proper headings', B.books, `
app "Books" book plum
table book title text, author text?, pages num 1..3000, done bool
section "Progress"
  count(book where done = yes) "finished" big
section "My books"
  each book sort title as b
    row card tap edit b swipe remove b
      toggle b.done
      b.title bold grow
      b.pages faint
section "Add"
  form book, "Add book"
`);
add('sections', 'se2', 'put the rent part and the tenants part under their own titles', B.rent, `
app "Rent" home slate
table tenant name text
table paid tenant ref tenant, amount money
setting rent money = 15000 "Monthly rent"
section "This month"
  "Collected" sum(paid.amount month) big
section "Tenants"
  each tenant sort name as t
    row card gap 2
      t.name bold grow
      if(sum(t.paid.amount month) >= rent, "Paid", "Due") color if(sum(t.paid.amount month) >= rent, good, bad)
  form tenant, "Add tenant"
`);
add('sections', 'se3', 'split this into cards, one for the sleep numbers and one for the chart', B.sleep, `
app "Sleep" bed ink
table night slept time, woke time
let avg7 = sum(night last 7 days, (it.woke - it.slept)) / count(night last 7 days)
section "Average"
  avg7 big
section "Last week"
  daybars last 7 days, sum(night on it, (it.woke - it.slept) / 1h)
form night, "Add night"
`);
// ---- setting_value
add('setting_value', 'sv1', 'a full round is 108 for me', B.tasbeeh, rep(B.tasbeeh, 'setting target num = 33 "Count to"', 'setting target num = 108 "Count to" set'));
add('setting_value', 'sv2', 'rent goes up to 18000 next month', B.rent, rep(B.rent, 'setting rent money = 15000 "Monthly rent"', 'setting rent money = 18000 "Monthly rent" set'));
add('setting_value', 'sv3', 'i am aiming at a lakh and a half now', B.savings, rep(B.savings, 'setting goal money = 100000 "Savings goal"', 'setting goal money = 150000 "Savings goal" set'));
// ---- rename_field (every use changes, `was` once)
add('rename_field', 'rf1', 'the bed time field should just be called bedtime', B.sleep, `
app "Sleep" bed ink
table night bedtime time was slept, woke time
let avg7 = sum(night last 7 days, (it.woke - it.bedtime)) / count(night last 7 days)
avg7 big
daybars last 7 days, sum(night on it, (it.woke - it.bedtime) / 1h)
form night, "Add night"
`);
add('rename_field', 'rf2', 'the name of the person should be called "who"', B.birthdays, `
app "Birthdays" gift plum
table person who text was name, birthday date
each person sort monthday(birthday) as p
  row card tap edit p swipe remove p
    p.who bold grow
    p.birthday faint
form person, "Add person"
`);
add('rename_field', 'rf3', 'rename the cost kind choices heading to "group"', B.shopcost, `
app "Shop costs" bag ocean
table cost what text, amount money, group pick Milk|Gas|Wages = Milk was kind
setting rent money = 15000 "Monthly rent"
let total = sum(cost.amount month) + rent
"This month" total big
each options cost.group as k
  row card
    k bold grow
    sum(cost.amount month where group = k) faint
form cost, "Add cost"
`);
// ---- rename_button
add('rename_button', 'rb1', 'the Add person button should say Remember', B.birthdays, rep(B.birthdays, 'form person, "Add person"', 'form person, "Remember"'));
add('rename_button', 'rb2', 'rename the plus button to Add one more', B.stock, rep(B.stock, 'button "+"', 'button "Add one more"'));
add('rename_button', 'rb3', 'make the pill button read Took it', B.medicine, rep(B.medicine, 'form med, "Add medicine"', 'form med, "Took it"'));
// ---- reorder (a line moves, nothing else changes)
add('reorder', 'ro1', 'chart first, then the list', rep(B.weight, 'trend weigh last 60 days sort at, it.kg\nform weigh, "Add weight"\nlist weigh by day', 'list weigh by day\nform weigh, "Add weight"\ntrend weigh last 60 days sort at, it.kg'), B.weight);
add('reorder', 'ro2', 'the form should come before the totals', B.pocket, rep(B.pocket, 'each kid as k\n  row card tap edit k\n    k.name bold grow\n    sum(k.move.amount where kind = Got) - sum(k.move.amount where kind = Spent) big\nform kid, "Add child"\nform move, "Add entry"', 'form kid, "Add child"\nform move, "Add entry"\neach kid as k\n  row card tap edit k\n    k.name bold grow\n    sum(k.move.amount where kind = Got) - sum(k.move.amount where kind = Spent) big'));
add('reorder', 'ro3', 'show how many are open above the list of jobs', rep(B.todo, 'stat count(job where done = no), "open"\neach job where done = no as j\n  row card gap 2 tap edit j swipe remove j\n    toggle j.done\n    j.title grow', 'each job where done = no as j\n  row card gap 2 tap edit j swipe remove j\n    toggle j.done\n    j.title grow\nstat count(job where done = no), "open"'), B.todo);
// ---- ask instead of a silent no-op: plain English, says what the app can do; the answer builds the change
add('cannot_do_ask', 'id1', 'send my spending to my accountant by email each friday', B.daily, `ask "Molde apps cannot send email. Do you want a weekly total on this screen that you can read out or screenshot?" "Yes, add a weekly total" "No, leave it as it is"`);
add('cannot_do_ask', 'id2', 'send my spending to my accountant by email each friday\nQuestion: Molde apps cannot send email. Do you want a weekly total on this screen that you can read out or screenshot?\nAnswer: Yes, add a weekly total', B.daily, rep(B.daily, 'stat sum(spend.amount month), "this month"', 'stat sum(spend.amount week), "this week"\nstat sum(spend.amount month), "this month"'));
add('cannot_do_ask', 'id3', 'lock the app with my fingerprint', B.habit, `ask "Molde apps cannot use the fingerprint reader. Your phone's own lock still protects them. Do you want anything else changed?" "No, that is fine" "Yes, something else"`);
// ---- vague: ask what to change, with choices that are real edits
add('vague_ask', 'vg1', 'can you make this look prettier', B.water, `ask "What should look nicer?" "A different colour" "Bigger text" "A chart of the week" "Leave it as it is"`);
add('vague_ask', 'vg2', 'it feels crowded', B.shopcost, `ask "What can go?" "The list of costs by kind" "The rent line" "Nothing, keep it"`);
add('vague_ask', 'vg3', 'can you make this look prettier\nQuestion: What should look nicer?\nAnswer: A chart of the week', B.water, rep(B.water, 'list drink', 'daybars last 7 days, sum(drink.ml on it)\nlist drink'));
for (const p of P) console.log(JSON.stringify(p));
