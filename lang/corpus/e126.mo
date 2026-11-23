app "Results" school ocean
table class name text
table student name text, class ref class
table subject name text, class ref class, total num 1.. = 100
table result student ref student, subject ref subject, marks num 0..
each class as c
  stack card gap 1
    row
      c.name bold grow
      count(c.subject) "subjects" faint
    "Class average" round(avg(result.marks where student.class = c)) bold
each subject as sb
  sb.name sb.class.name head
  each result where subject = sb sort marks desc top 10 as r
    row card
      r.student.name bold grow
      r.marks
      round(100 * r.marks / sb.total) "%"
      if(r.marks * 100 / sb.total >= 80, "A", if(r.marks * 100 / sb.total >= 65, "B", if(r.marks * 100 / sb.total >= 50, "C", if(r.marks * 100 / sb.total >= 40, "D", "F"))))
form class, "Add class"
form student, "Add student"
form subject, "Add subject"
form result, "Enter marks"
