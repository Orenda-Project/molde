app "Class" school ocean
table student name text
table attend student ref student, present bool = yes
table mark student ref student, subject text, score num 0..100
table note student ref student, note long
"Present today" count(attend today where present = yes) "of" count(student) big
each student
  row card gap 1
    it.name bold grow
    toggle it.attend
    "Avg" round(avg(it.mark.score)) faint
    button "Details" tap edit it
form student, "Add student"
form mark, "Add homework mark"
form note, "Add behaviour note"
each student
  stack card gap 1
    "Report card:" it.name head
    each it.mark
      row
        it.subject grow
        it.score bold
    "Average" round(avg(it.mark.score)) "| Days present" count(it.attend where present = yes) "| Notes" count(it.note) faint
