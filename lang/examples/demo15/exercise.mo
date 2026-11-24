app "Workouts" dumbbell ink
table lift exercise text, kg num 0.. = 0 unit "kg", sets num 1..20 = 3, reps num 1..100
let vol = sum(lift week, it.kg * it.sets * it.reps)
topbar "Workouts", lift, "Log exercise"
weekdots count(lift on it) > 0
statcard vol, "kg lifted this week (sets x reps x kg)"
section "Volume per day", "days trained:" count(days week, count(lift on it) > 0)
  daybars week, sum(lift on it, it.kg * it.sets * it.reps)
list lift today by day, "Nothing logged today. Tap Log exercise after a set."
