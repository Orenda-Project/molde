app "Mess" food ocean
table student name text, fee money
table extra student ref student, what text, amount money
table payment student ref student, amount money
state m date = today
monthnav m
"Collected this month" sum(payment.amount month of m) big
"Still to collect" sum(student.fee) + sum(extra.amount month of m) - sum(payment.amount month of m) faint
each student as s
  let bal = s.fee + sum(s.extra.amount month of m) - sum(s.payment.amount month of m)
  row card tap edit s
    s.name bold grow
    if(bal > 0, "owes", "settled") abs(bal) color if(bal > 0, bad, good)
form student, "Add student"
form extra, "Add extra item"
form payment, "Add payment"
