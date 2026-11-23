app "Ramadan" moon plum
table roza day date, sehri time, iftar time, status pick Done|Missed = Done, reason text?
"Roza kept" count(roza where status = Done) "| Missed" count(roza where status = Missed) big
each roza where status = Missed sort day
  row card
    it.day grow
    it.reason faint
form roza, "Add day"
each roza sort day
  row card tap edit it
    stack grow
      it.day bold
      "Sehri" it.sehri "Iftar" it.iftar faint
    it.status bold color if(it.status = Done, good, bad)
