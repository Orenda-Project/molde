app "Medicines" pill plum
table med name text, dose text?, per_day num 1..12 = 1, started date = today, stock num 0.. "Stock at start"
table taken med ref med
when countof(med, floor((it.stock - count(it.taken)) / it.per_day) <= 5) > 0 notify "A medicine has 5 days or less left"
each med as m
  let left = m.stock - count(m.taken)
  let dleft = floor(left / m.per_day)
  stack card gap 1 tap edit m swipe remove m
    row gap 1
      stack grow
        m.name m.dose bold
        m.per_day "times a day since" m.started faint
      button "Took one" tap add taken med = m
    left "left," dleft "days" bold color if(dleft <= 5, bad, good)
form med, "Add medicine"
