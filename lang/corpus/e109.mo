app "Attendance" school ocean
table student name text, section pick A|B|C|D = A
table mark student ref student, status pick Present|Late|Absent = Present
state sec pick A|B|C|D = A
choice sec
count(mark today where status = Late) "late today" head
each student where section = sec sort name as s
  row card gap 1
    s.name grow
    last(s.mark.status today) color if(last(s.mark.status today) = Late, warn, ink)
    button "P" tap add mark student = s, status = Present
    button "Late" tap add mark student = s, status = Late
    button "A" tap add mark student = s, status = Absent
form student, "Add student"
