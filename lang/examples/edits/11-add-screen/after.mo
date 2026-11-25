app "Medicine" pill plum
table med name text, dose text?, time time
table taken med ref med
remind "Time for your medicine" at med.time
count(taken today) "of" count(med) "doses taken today" head
each med sort time
  row card gap 2 tap edit it swipe remove it
    stack grow
      it.name bold
      it.time it.dose faint
    toggle it.taken
form med, "Add medicine"
screen history "History" calendar
  list taken by day
