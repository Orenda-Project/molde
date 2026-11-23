app "Tuition fees" school ocean
table student name text, fee money
table paid student ref student, amount money
let due_total = sum(student, if(count(it.paid month) = 0, it.fee, 0))
"Fees due this month" due_total big
each student sort name as s
  row card gap 1
    s.name bold grow
    if count(s.paid month) = 0
      s.fee color warn bold
      button "Paid" tap add paid student = s, amount = s.fee
    else
      "Paid" color good
form student, "Add student"
list paid by day
