app "Attendance" users ocean
table student name text
table absent student ref student
state d date = today
let away = count(absent on d)
topbar student, "Add student"
monthnav d
statcard count(student) - away, "of" count(student) "present", count(student)
grid 3 gap 1
  each student sort name as s empty "No students yet. Add the names in your class."
    stack radius 10 pad 1 gap 0 fill if(count(s.absent on d) > 0, bad, soft) tap toggle s.absent on d
      s.name bold
      if(count(s.absent on d) > 0, "Absent", "Present") faint
section "This month", "most absent"
  share student sort count(it.absent month of d) desc top 5, count(it.absent month of d), it.name
