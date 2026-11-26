// DATA_SPEC_r5 lever 2: a plan line before the program. node spec/plans.mjs > spec/plans.jsonl ; node tools/validate_plans.mjs spec/plans.jsonl
const P = [];
const add = (cls, id, request, plan, program) => P.push({ class: cls, id, kind: 'create_plan', request, plan, program: program.trim() + '\n' });
add('plan_line', 'pl1', 'paani peene ka hisaab', '# need: field drink, field ml, goal, quick buttons, chart, list', `
app "Paani" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500, 750]
daybars last 7 days, sum(drink.ml on it)
list drink
`);
add('plan_line', 'pl2', 'a mood diary where i pick how i feel', '# need: option happy/ok/sad/angry, field note, chart month, list', `
app "Mood" smile ink
table entry mood pick Happy|Ok|Sad|Angry = Ok, note text?
share entry month by mood, count(it), it.key
form entry, "Add mood"
list entry by day
`);
add('plan_line', 'pl3', 'daily petrol log with litres, price per litre, odometer and a calculated mileage per litre and monthly cost', '# need: field litres, field price, field odometer, mileage, total month, list', `
app "Petrol" car slate
table refuel litres num 1..200, price money, odo num 0..2000000 "Odometer"
let km = max(refuel.odo) - min(refuel.odo)
"Cost this month" sum(refuel month, it.litres * it.price) big
"Mileage" round(km / max(sum(refuel.litres), 1) * 10) / 10 "km per litre" faint
form refuel, "Add refuel"
list refuel by day
`);
add('plan_line', 'pl4', 'sals report', '# need: field amount, total today, total month, chart, list', `
app "Sales report" chart slate
table sale item text, amount money
stat sum(sale.amount today), "today"
stat sum(sale.amount month), "this month"
form sale, "Add sale"
daybars last 7 days, sum(sale.amount on it)
list sale by day
`);
add('plan_line', 'pl5', 'live cricket scores from the internet', '# need: cannot internet, field runs, field wickets, list', `
app "Score sheet" ball ocean
table score runs num 0..999, wickets num 0..10, overs num 0..50
last(score.runs) "/" last(score.wickets) big
"Type the score by hand: Molde apps work without the internet." faint
form score, "Update score"
list score by day
`);
add('plan_line', 'pl6', 'bachon ki fees ka record, kis ne di kis ne nahi', '# need: field child, field fee, field paid, total month, list', `
app "Fees" school ocean
table child name text, fee money
table paid child ref child, amount money
let due_total = sum(child, if(count(it.paid month) = 0, it.fee, 0))
"Fees due this month" due_total big
each child sort name as c
  row card gap 1
    c.name bold grow
    if count(c.paid month) = 0
      c.fee color warn bold
      button "Paid" tap add paid child = c, amount = c.fee
    else
      "Paid" color good
form child, "Add child"
`);
for (const p of P) console.log(JSON.stringify(p));
