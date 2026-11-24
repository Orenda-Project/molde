app "Gym log" dumbbell ink
table workout exercise text, sets num 1..20, reps num 1..100, weight num 0.. unit "kg"
table body kg num 20..300 unit "kg"
remind "Time to train" at 18:00
row gap 2
  stat streak(workout), "day streak"
  stat count(workout week), "workouts this week"
"Workouts per day" head
daybars last 7 days, count(workout on it)
form workout, "Log workout"
list workout by day
"Body weight" head
trend body, it.kg
form body, "Log weight"
