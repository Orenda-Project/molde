app "Attendance" users ocean
table student name text
table present student ref student
form student, "Add student"
row gap 1
  "Student" tiny grow
  each days last 7 days as d
    dayname(d) tiny width 6
each student as s empty "No students yet"
  row gap 1
    s.name grow
    each days last 7 days as d
      box height 28 width 6 radius 6 tap toggle s.present on d fill if(count(s.present on d) > 0, good, soft)
row gap 1
  "Present" tiny grow
  each days last 7 days as d
    count(present on d) tiny width 6
