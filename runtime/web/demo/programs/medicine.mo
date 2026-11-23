app "Medicine" pill plum
table med name text, dose text?, time time
table taken med ref med
state adding bool = no
state d new med
let n = count(med)
let took = countof(med, count(it.taken today) > 0)
remind "Time for your medicine" at med.time
row
  button if(adding, "Close", "Add medicine") fill if(adding, soft, accent) tap set adding = not adding
if adding
  stack card gap 3
    field d.name "Medicine"
    field d.dose "Dose"
    field d.time "Time"
    button "Save medicine" fill accent tap save d then set adding = no
if n = 0
  stack card gap 2
    "No medicines yet" head
    "Add each medicine with the time you take it. You get a reminder at that time." color muted
else
  stack gap 0
    text took "of" n if(n = 1, "dose", "doses") "taken today" head
    if took >= n
      "All taken" color good
    else
      text n - took "still to take" color muted
  each med sort time as m
    stack card gap 2 tap edit m swipe remove m
      row gap 2
        stack grow gap 0
          m.name bold
          m.time m.dose faint
        toggle m.taken
      row gap 1
        each days last 7 days
          stack grow gap 0 align center
            dayname(it) size tiny color muted
            box height 10 width 24 radius 5 fill if(count(m.taken on it) > 0, accent, soft)
