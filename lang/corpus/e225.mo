app "Gym" dumbbell ink
table plan day pick Mon|Wed|Fri, exercise text, sets num 1..10 = 3, reps num 1..30 = 10
table lift exercise ref plan, kg num 0..
setting start date = today "Programme start"
"Week" clamp(floor((today - start) / 7) + 1, 1, 12) "of 12" head
each options plan.day as dd
  text dd head
  each plan where day = dd as p
    state w num = 0
    stack card gap 1
      row gap 1
        p.exercise bold grow
        p.sets "x" p.reps faint
      row gap 1
        field w "Weight lifted (kg)"
        button "Log" tap add lift exercise = p, kg = w
      trend p.lift sort at, it.kg
      "Best" max(p.lift.kg) "kg" faint
form plan, "Add exercise"
