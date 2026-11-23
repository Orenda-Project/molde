app "Workouts" dumbbell ink
table lift exercise text, kg num 0.. = 0 unit "kg", sets num 1..20 = 3, reps num 1..100
state ex text = last(lift.exercise)
state adding bool = no
state d new lift keep
let vol = sumof(lift week, it.kg * it.sets * it.reps)
let before = sumof(lift prev week where weekday(at) <= weekday(today), it.kg * it.sets * it.reps)
let trained = countof(days week, count(lift on it) > 0)
let hi = max(lift.kg last 35 days where exercise = ex)
let lo = min(lift.kg last 35 days where exercise = ex)
row
  button if(adding, "Close", "Log exercise") fill if(adding, soft, accent) tap set adding = not adding
if adding
  stack card gap 3
    field d
    "Use 0 kg for bodyweight moves like push-ups." faint
    button "Save set" fill accent tap save d then set adding = no
row gap 1
  each days week
    stack grow gap 1 align center
      dayname(it) size tiny color if(it = today, ink, muted)
      box height 36 radius 8 fill if(count(lift on it) > 0, accent, soft)
        text it if(count(lift on it) > 0, ", trained", ", rest") opacity 0
stack gap 1
  if count(lift today) > 0
    count(lift today) if(count(lift today) = 1, "exercise", "exercises") "today," sumof(lift today, it.sets) "sets" head
  else
    "No training yet today" head
  if trained > 0
    text trained if(trained = 1, "day", "days") "this week," round(vol / 100) / 10 "t moved" color muted
    if before > 0
      round((vol - before) * 100 / before) "% compared with the same days last week" faint
  else
    "Nothing logged this week yet. Tap Log exercise after your first set." color muted
  if count(lift) > 0
    button "Repeat last set" tap add lift exercise = last(lift.exercise), kg = last(lift.kg), sets = last(lift.sets), reps = last(lift.reps)
stack card gap 3
  "Progress" head
  if count(lift) = 0
    "Your progress shows here once you have logged an exercise twice." color muted
  else
    scroll gap 1
      each lift last 60 days by exercise
        button it.key fill if(ex = it.key, ink, surface) tap set ex = it.key
    if count(lift last 35 days where exercise = ex) < 2
      "Log" ex "twice to see a line." color muted
    else
      row gap 3
        stack gap 0
          text hi "kg" head
          "best set, 5 weeks" faint
        stack gap 0
          count(lift last 35 days where exercise = ex) "times" head
          "logged" faint
      draw 110, 64
        line 22, 6, 108, 6 stroke edge thick 0.3
        line 22, 30, 108, 30 stroke edge thick 0.3
        line 22, 54, 108, 54 stroke edge thick 0.3
        label 10, 6, hi size tiny color muted
        label 10, 30, round((hi + lo) / 2 * 10) / 10 size tiny color muted
        label 10, 54, lo size tiny color muted
        poly stroke accent thick 1.2
          each lift last 35 days where exercise = ex sort at
            pt 106 - 84 * ((now - it.at) / 1d) / 35, 54 - 48 * (it.kg - lo) / max(hi - lo, 1)
        circle 106 - 84 * ((now - last(lift.at where exercise = ex)) / 1d) / 35, 54 - 48 * (last(lift.kg where exercise = ex) - lo) / max(hi - lo, 1), 1.8 fill accent
        label 34, 62, today - 34 size tiny color muted
        label 100, 62, "Today" size tiny color muted
      "Latest:" last(lift.kg where exercise = ex) "kg for" last(lift.reps where exercise = ex) "reps. Weights in kg." faint
"Recent" head
if count(lift last 14 days) = 0
  "Nothing logged in the last two weeks." color muted
each lift last 14 days by day as g
  g.key bold faint
  each g as r
    row card tap edit r swipe remove r
      r.exercise grow bold
      r.sets "x" r.reps color muted
      r.kg "kg"
