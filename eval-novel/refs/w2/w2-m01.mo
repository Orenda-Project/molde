app "Tuition centre" school ocean
table student name text, class text, fee money
table payment student ref student, amount money, paid_on date = today
table present student ref student
remind "Collect this month's fees" monthly on 5 at 9:00
stat sum(payment.amount month), "fees collected this month"
"Fees collected per month" head
bars 0..5, sum(payment.amount month of addmonths(today, it - 5)), monthname(addmonths(today, it - 5))
"Students" head
form student, "Add student"
each student as s empty "No students yet"
  row card tap edit s swipe remove s
    stack gap 0 grow
      s.name bold
      s.class faint
    s.fee
    toggle s.present
"Not paid this month" head
each student as s
  if count(s.payment month) = 0
    row card
      s.name grow
      s.fee color bad
"Record a payment" head
form payment, "Save payment"
