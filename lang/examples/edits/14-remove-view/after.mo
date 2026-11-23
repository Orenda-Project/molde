app "Exercise" dumbbell ink
table sets exercise text, kg num? 0.., reps num 1..
text count(sets today) "sets today," sumof(sets today, it.kg * it.reps) "kg moved" head
daybars last 7 days, count(sets on it)
form sets
button "Repeat last set" tap add sets exercise = last(sets.exercise), kg = last(sets.kg), reps = last(sets.reps)
state ex text = last(sets.exercise)
field ex "Progress for"
trend sets where exercise = ex sort at, it.kg
log sets
