app "Ramadan Planner" moon plum
table day d date, sehri time, iftar time, roza bool = yes "Roza kept", rakaat num 0..20 = 8 "Taraweeh rakaat", note text?
form day, "Add day"
each day sort d
  row card tap edit it
    stack grow
      it.d bold
      "Sehri" it.sehri "Iftar" it.iftar it.note faint
    if(it.roza, "Roza", "Missed") bold color if(it.roza, good, bad)
"Total roza kept" count(day where roza = yes) head
"Total missed" count(day where roza = no) head
"Days missed:" head
each day where roza = no sort d
  it.d
