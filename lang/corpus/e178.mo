app "Fitness" run mint
table steps count num 0..
table workout kind text, mins num 1..300
table weigh kg num 20..300
table water ml num 1..5000
let w_now = last(weigh.kg)
sum(steps.count today) "steps today" big
sum(workout.mins week) "workout min this week," sum(water.ml today) "ml water today" head
form steps, "Add steps"
form workout, "Log workout"
form weigh, "Log weight"
quick water, ml, [250, 500]
trend weigh, it.kg
"Weekly summary" head
stack card gap 1
  if(sum(steps.count week) > sum(steps.count prev week), "Steps up", "Steps down or the same") "vs last week" color if(sum(steps.count week) > sum(steps.count prev week), good, warn)
  if(sum(workout.mins week) > sum(workout.mins prev week), "More workout minutes", "Fewer workout minutes") color if(sum(workout.mins week) > sum(workout.mins prev week), good, warn)
  if(sum(water.ml week) > sum(water.ml prev week), "More water", "Less water") color if(sum(water.ml week) > sum(water.ml prev week), good, warn)
  if(avg(weigh.kg week) < avg(weigh.kg prev week), "Weight down", "Weight not down") color if(avg(weigh.kg week) < avg(weigh.kg prev week), good, muted)
