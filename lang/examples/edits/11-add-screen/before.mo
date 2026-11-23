app "Medicine" pill plum
table med name text, dose text?, time time
table taken med ref med
remind "Time for your medicine" at med.time
text count(taken today) "of" count(med) "doses taken today" head
each med sort time
  row card gap 2 tap edit it swipe remove it
    stack grow
      text it.name bold
      text it.time it.dose faint
    toggle it.taken
form med, "Add medicine"
