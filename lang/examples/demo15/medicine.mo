app "Medicine" pill plum
table med name text, dose text?, time time
table taken med ref med
let n = count(med)
let took = count(med, count(it.taken today) > 0)
remind "Time for your medicine" at med.time
topbar "Medicine", med, "Add medicine"
statcard took, "of" plural(n, "dose") "taken today", n
each med sort time as m empty "No medicines yet. Add each one with the time you take it."
  stack card gap 2 tap edit m swipe remove m
    row gap 2
      stack grow gap 0
        m.name bold
        m.time m.dose faint
      toggle m.taken
    weekdots count(m.taken on it) > 0
