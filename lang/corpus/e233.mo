app "Get fitter" run mint
table workout what pick Walk|Run|Strength|Stretch|Cycle, mins num 5..180 = 20
table weigh kg num 20..300
setting weekly num = 3 "Workouts a week"
"Start small: three short sessions this week." head
"Week 1: walk 20 minutes. Week 2: walk 25 minutes and stretch. Week 3: add one strength day." faint
goal count(workout week), weekly, "this week", "workouts"
quick workout, what, ["Walk", "Strength"]
form workout
daybars last 7 days, sum(workout.mins on it)
"Weight" head
form weigh, "Log weight"
trend weigh last 30 days sort at, it.kg
