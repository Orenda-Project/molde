app "Workouts" dumbbell ink
table lift exercise text, kg num 0.. = 0 unit "kg", sets num 1..20 = 3, reps num 1..100
let vol = sumof(lift week, it.kg * it.sets * it.reps)
let before = sumof(lift prev week where weekday(at) <= weekday(today), it.kg * it.sets * it.reps)
state ex text = last(lift.exercise)
stack card gap 3
  if count(lift today) > 0
    text "Trained today" faint color good
    text count(lift today) "exercises," sumof(lift today, it.sets) "sets" head
    text sumof(lift today, it.kg * it.sets * it.reps) "kg moved so far" color muted
  else
    text "Rest day so far" faint
    text "Last trained" since(lift) "days ago" head
  row gap 1
    button "Repeat last" grow tap add lift exercise = last(lift.exercise), kg = last(lift.kg), sets = last(lift.sets), reps = last(lift.reps)
  row gap 1
    each days week
      stack grow gap 1 align center
        text dayname(it) size tiny color if(it = today, ink, muted) bold
        box height 28 radius 6 fill if(count(lift on it) > 0, accent, soft)
  divider
  row gap 3
    stack gap 0
      text "This week" faint
      text countof(days week, count(lift on it) > 0) "days" head
      text "trained" faint
    stack gap 0
      text "Volume" faint
      text round(vol / 100) / 10 "t" head
      text round((vol - before) * 100 / before) "% vs same days last week" faint
    stack gap 0
      text "Sessions" faint
      text countof(days last 30 days, count(lift on it) > 0) head
      text "in 30 days" faint
stack card gap 3
  text "Progress" head
  scroll gap 1
    each lift last 60 days by exercise
      button it.key fill if(ex = it.key, accent, soft) tap set ex = it.key
  row gap 3
    stack gap 0
      text max(lift.kg where exercise = ex) "kg" head
      text "best set" faint
    stack gap 0
      text count(lift where exercise = ex) head
      text "times logged" faint
  draw 100, 44
    line 0, 42, 100, 42 stroke edge thick 0.4
    poly stroke accent thick 1.2
      each lift where exercise = ex sort at
        pt 4 + 92 * index / max(count(lift where exercise = ex) - 1, 1), 40 - 32 * (it.kg - min(lift.kg where exercise = ex)) / max(max(lift.kg where exercise = ex) - min(lift.kg where exercise = ex), 1)
  text "Top weight each time you logged" ex faint
text "Log a set" head
form lift, "Add set"
text "Use 0 kg for bodyweight moves like push-ups." faint
text "Recent" head
each lift last 14 days by day as g
  text g.key bold faint
  each g as r
    row card tap edit r swipe remove r
      text r.exercise grow bold
      text r.sets "x" r.reps color muted
      text r.kg "kg"
