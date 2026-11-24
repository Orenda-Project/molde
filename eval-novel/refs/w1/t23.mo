app "Mum BP" heart ocean
table reading period pick Morning|Evening, sys num 50..300 "Systolic", dia num 30..200 "Diastolic", pulse num 30..250
stat if(last(reading.sys) > 140 or last(reading.dia) > 90, "High", "OK"), "last reading"
form reading, "Add reading"
"Systolic over time" head
trend reading, it.sys
each reading as r empty "No readings yet"
  row card fill if(r.sys > 140 or r.dia > 90, bad, surface) tap edit r swipe remove r
    r.period bold grow
    r.sys "/" r.dia bold
    "pulse" r.pulse faint
