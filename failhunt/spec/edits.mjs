// DATA_SPEC_r5 example pairs (edits). node edits.mjs > edits.jsonl ; node ../tools/validate_spec.mjs edits.jsonl
const P = [];
const add = (cls, id, request, before, program) => P.push({ class: cls, id, kind: 'edit', request, before: before.trim() + '\n', program: program.trim() + '\n' });
const WATER = `
app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500, 750]
daybars last 7 days, sum(drink.ml on it)
list drink
`;
const SPEND = `
app "Spending" wallet mint
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
setting budget money = 80000 "Monthly budget"
let spent = sum(spend.amount month)
if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
form spend, "Add expense"
share spend month by category, sum(it.amount), it.key
list spend month by day
`;
const TODO = `
app "To do" list slate
table task title text, done bool, priority pick Low|Normal|High = Normal
count(task where done = no) "open" head
each task where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    t.title grow
form task, "Add task"
`;

// ---- E1 add a field (the model returned the program unchanged)
add('add_field', 'af1', 'add a note field', WATER, WATER.replace('table drink ml num 1..5000 unit "ml"', 'table drink ml num 1..5000 unit "ml", note text?'));
add('add_field', 'af2', 'add a field for payment method', SPEND, SPEND.replace('category pick Food|Bills|Travel|Fun|Other = Other', 'category pick Food|Bills|Travel|Fun|Other = Other, method pick Cash|Card|Other = Cash'));
add('add_field', 'af3', 'can you add a due date', TODO, TODO.replace('priority pick Low|Normal|High = Normal', 'priority pick Low|Normal|High = Normal, due date?'));
// ---- E2 add an option to a choice
add('add_option', 'ao1', 'add Online as an option', SPEND, SPEND.replace('Food|Bills|Travel|Fun|Other = Other', 'Food|Bills|Travel|Fun|Online|Other = Other'));
add('add_option', 'ao2', 'also let me pick Urgent', TODO, TODO.replace('Low|Normal|High = Normal', 'Low|Normal|High|Urgent = Normal'));
add('add_option', 'ao3', 'add Cash to the choices', SPEND.replace('Food|Bills|Travel|Fun|Other = Other', 'Food|Bills|Travel|Fun|Card|Other = Card'), SPEND.replace('Food|Bills|Travel|Fun|Other = Other', 'Food|Bills|Travel|Fun|Card|Cash|Other = Card'));
// ---- E3 remove one thing and keep everything else
add('remove_one', 'rm1', 'remove the chart', WATER, WATER.replace('daybars last 7 days, sum(drink.ml on it)\n', ''));
add('remove_one', 'rm2', 'remove the list at the bottom', SPEND, SPEND.replace('list spend month by day\n', ''));
add('remove_one', 'rm3', 'i do not need the goal', WATER, WATER.replace('goal sum(drink.ml today), goal, "today", "ml"\n', ''));
// ---- E4 add a chart / a stat
add('add_chart_stat', 'ac1', 'add a bar chart of this week', TODO.replace('form task, "Add task"', 'form task, "Add task"'), TODO + 'daybars last 7 days, count(task on it)\n');
add('add_chart_stat', 'ac2', 'show the average too', `
app "Weight" scale mint
table weigh kg num 20..300
last(weigh.kg) "kg" big
form weigh, "Add weight"
list weigh by day
`, `
app "Weight" scale mint
table weigh kg num 20..300
last(weigh.kg) "kg" big
stat round(avg(weigh.kg last 30 days) * 10) / 10, "average, last 30 days"
form weigh, "Add weight"
list weigh by day
`);
add('add_chart_stat', 'ac3', 'add a count of entries this week', SPEND, SPEND.replace('form spend, "Add expense"', 'stat count(spend week), "expenses this week"\nform spend, "Add expense"'));
// ---- E5 sections
add('sections', 'se1', 'split it into sections', SPEND, `
app "Spending" wallet mint
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
setting budget money = 80000 "Monthly budget"
let spent = sum(spend.amount month)
section "This month", "budget and spending"
  if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
  goal spent, budget, "spent"
section "Add"
  form spend, "Add expense"
section "Where it went", "this month"
  share spend month by category, sum(it.amount), it.key
section "History"
  list spend month by day
`);
add('sections', 'se2', 'group things into sections with titles', TODO, `
app "To do" list slate
table task title text, done bool, priority pick Low|Normal|High = Normal
section "Open", "what is left"
  count(task where done = no) "open" head
  each task where done = no sort priority desc as t
    row card gap 2 tap edit t swipe remove t
      toggle t.done
      t.title grow
section "Add"
  form task, "Add task"
`);
add('sections', 'se3', 'organise this with section headings', WATER, `
app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
section "Today", "against the goal"
  goal sum(drink.ml today), goal, "today", "ml"
  quick drink, ml, [250, 500, 750]
section "This week"
  daybars last 7 days, sum(drink.ml on it)
section "Drinks"
  list drink
`);
// ---- E6 a number changed with different wording than "change the goal to N"
add('setting_value', 'sv1', 'i want to aim for 3000 instead', WATER, WATER.replace('= 2000 "Daily goal (ml)"', '= 3000 "Daily goal (ml)" set'));
add('setting_value', 'sv2', 'make the monthly limit 60000', SPEND, SPEND.replace('= 80000 "Monthly budget"', '= 60000 "Monthly budget" set'));
add('setting_value', 'sv3', 'set the target to 100', `
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 33 "Count to"
let n = count(zikr today)
"Count" n big
button "Tap" tap add zikr
`, `
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 100 "Count to" set
let n = count(zikr today)
"Count" n big
button "Tap" tap add zikr
`);
// ---- E7 rename a field (needs "was")
add('rename_field', 'rf1', 'rename ml to amount', WATER, `
app "Water" drop ocean
table drink amount num 1..5000 unit "ml" was ml
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.amount today), goal, "today", "ml"
quick drink, amount, [250, 500, 750]
daybars last 7 days, sum(drink.amount on it)
list drink
`);
add('rename_field', 'rf2', 'call the what field item', SPEND, `
app "Spending" wallet mint
table spend item text was what, amount money, category pick Food|Bills|Travel|Fun|Other = Other
setting budget money = 80000 "Monthly budget"
let spent = sum(spend.amount month)
if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
form spend, "Add expense"
share spend month by category, sum(it.amount), it.key
list spend month by day
`);
add('rename_field', 'rf3', 'rename the title field to task', TODO, `
app "To do" list slate
table task task text was title, done bool, priority pick Low|Normal|High = Normal
count(task where done = no) "open" head
each task where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    t.task grow
form task, "Add task"
`);
// ---- E8 rename a button
add('rename_button', 'rb1', 'rename the Add expense button to Spend', SPEND, SPEND.replace('form spend, "Add expense"', 'form spend, "Spend"'));
add('rename_button', 'rb2', 'the Add task button should say New task', TODO, TODO.replace('form task, "Add task"', 'form task, "New task"'));
add('rename_button', 'rb3', 'change the Add weight button to say Weigh in', `
app "Weight" scale mint
table weigh kg num 20..300
last(weigh.kg) "kg" big
form weigh, "Add weight"
list weigh by day
`, `
app "Weight" scale mint
table weigh kg num 20..300
last(weigh.kg) "kg" big
form weigh, "Weigh in"
list weigh by day
`);
// ---- E9 reorder
add('reorder', 'ro1', 'put the add form at the top', SPEND, `
app "Spending" wallet mint
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Other
setting budget money = 80000 "Monthly budget"
let spent = sum(spend.amount month)
form spend, "Add expense"
if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
share spend month by category, sum(it.amount), it.key
list spend month by day
`);
add('reorder', 'ro2', 'put the chart above the list', WATER.replace('daybars last 7 days, sum(drink.ml on it)\nlist drink', 'list drink\ndaybars last 7 days, sum(drink.ml on it)'), WATER);
add('reorder', 'ro3', 'move the totals to the top', `
app "To do" list slate
table task title text, done bool, priority pick Low|Normal|High = Normal
each task where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    t.title grow
stat count(task where done = no), "open"
form task, "Add task"
`, `
app "To do" list slate
table task title text, done bool, priority pick Low|Normal|High = Normal
stat count(task where done = no), "open"
each task where done = no sort priority desc as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    t.title grow
form task, "Add task"
`);
// ---- E10 vague requests: one small safe change, never a rewrite
add('vague_small', 'vg1', 'make it nicer', WATER, WATER.replace('app "Water" drop ocean', 'app "Water" drop teal'));
add('vague_small', 'vg2', 'make it simpler', SPEND, SPEND.replace('share spend month by category, sum(it.amount), it.key\n', ''));
add('vague_small', 'vg3', 'this is too busy', TODO.replace('form task, "Add task"', 'form task, "Add task"\ndaybars last 7 days, count(task on it)'), TODO);
// ---- E11 requests the app cannot do: the program comes back unchanged (the app then says so)
add('cannot_do_identity', 'id1', 'email me a report every week', WATER, WATER);
add('cannot_do_identity', 'id2', 'sync this with google drive', SPEND, SPEND);
add('cannot_do_identity', 'id3', 'add a password lock', TODO, TODO);
for (const p of P) console.log(JSON.stringify(p));
