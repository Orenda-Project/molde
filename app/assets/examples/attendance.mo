app "Attendance" users ocean
table student name text
table absent student ref student
state d date = today
state adding bool = no
let away = count(absent on d)
row align center gap 1
  button "<" tap set d = d - 1
  dayname(d) monthday(d) monthname(d) bold
  if d >= today
    box width 44
  else
    button ">" tap set d = d + 1
if count(student) = 0
  stack card gap 2
    "No students yet" head
    "Add the names in your class, then tap a name to mark that child absent." color muted
else
  stack gap 0
    count(student) - away "of" count(student) "present" big
    if away > 0
      away "absent today" color muted
    else
      "Everyone is here" color good
  grid 3 gap 1
    each student sort name as s
      stack radius 10 pad 1 gap 0 fill if(count(s.absent on d) > 0, bad, soft) tap toggle s.absent on d
        s.name bold
        if count(s.absent on d) > 0
          "Absent" small
        else
          "Present" faint
  "Tap a name to mark absent. Everyone starts present." faint
  stack card gap 2
    "This month" head
    each student sort count(it.absent month of d) desc top 5 as s
      row
        s.name grow
        plural(count(s.absent month of d), "day") "absent" color muted
button if(adding, "Close", "Add student") tap set adding = not adding
if adding
  form student, "Save student"
