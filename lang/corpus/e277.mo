app "Tuition" school ocean
table student name text, fee money
table feepaid student ref student, amount money
table exam subject text, on_date date
table teacher name text, salary money
state m date = today
monthnav m
"Profit this month" sum(feepaid.amount month of m) - sum(teacher.salary) big
row gap 2
  stat sum(feepaid.amount month of m), "fees collected"
  stat sum(teacher.salary), "salaries"
  stat count(student), "students"
"Fees not yet paid this month" head
each student as s
  if sum(s.feepaid.amount month of m) < s.fee
    row card
      s.name grow
      s.fee - sum(s.feepaid.amount month of m) color bad
"Exams" head
each exam sort on_date as e
  row card tap edit e swipe remove e
    e.subject bold grow
    e.on_date
form student, "Add student"
form feepaid, "Add fee payment"
form exam, "Add exam"
form teacher, "Add teacher"
