app "Attendance" users ocean
table student name text
table absent student ref student
state d date = today
row align center
  button "<" tap set d = d - 1
  dayname(d) monthday(d) monthname(d) head grow align center
  button ">" tap set d = d + 1
count(student) - count(absent on d) "of" count(student) "present" big
grid 4 gap 1
  each student sort name as s
    stack radius 8 pad 1 fill if(count(s.absent on d) > 0, bad, good) tap toggle s.absent on d
      s.name bold align center color bg
      if(count(s.absent on d) > 0, "Absent", "Present") size tiny align center color bg
"Tap a name to mark absent. Everyone starts present." faint
each student sort name as s
  row
    s.name grow
    count(s.absent month of d) "days absent this month" faint
form student, "Add student"
