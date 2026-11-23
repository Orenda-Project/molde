app "Kids activities" users mint
table kid name text
table activity kid ref kid, what text, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun = Mon, start time, place text?
"Today" head
each activity where day = dayname(today) sort start as a
  row card
    a.start bold
    a.kid.name a.what grow
    a.place faint
grid 2 gap 1
  each options activity.day as dd
    stack card gap 1
      dd bold
      each activity where day = dd sort start as a
        stack tap edit a gap 0
          a.start a.kid.name size small bold
          a.what a.place size tiny faint
form activity, "Add activity"
form kid, "Add child"
