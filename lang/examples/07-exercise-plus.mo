app "Exercise" dumbbell ink
table lift exercise text, kg num 0.. = 0, sets num 1.. = 3, reps num 1..
let vol = sumof(lift week, it.kg * it.sets * it.reps)
let before = sumof(lift prev week, it.kg * it.sets * it.reps)
row gap 2
  stat vol, "kg moved this week"
  stat round((vol - before) * 100 / before), "% vs last week"
  stat countof(days week, count(lift on it) > 0), "days trained"
form lift
"Use 0 kg for bodyweight moves like push-ups." faint
button "Repeat last" tap add lift exercise = last(lift.exercise), kg = last(lift.kg), sets = last(lift.sets), reps = last(lift.reps)
"New records, last 30 days" head
each lift last 30 days sort kg desc as r
  if r.kg > 0 and r.kg = max(lift.kg where exercise = r.exercise)
    r.exercise r.kg "kg" bold
state ex text = last(lift.exercise)
field ex "Progress for"
trend lift where exercise = ex sort at, it.kg
"Best" max(lift.kg where exercise = ex) "kg" faint
daybars last 7 days, count(lift on it)
log lift
