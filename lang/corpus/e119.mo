app "Tuition centre" school ocean
table student name text, class text, fee money, discount money = 0
table payment student ref student, amount money
let unpaid = countof(student, count(it.payment month) = 0)
unpaid "students have not paid this month" head color if(unpaid > 0, warn, good)
stat sum(payment.amount month), "collected this month"
"Defaulters" head
each student sort name as s
  if count(s.payment month) = 0
    row card
      s.name bold grow
      s.class
      s.fee - s.discount
"All students" head
each student sort name as s
  row card gap 1 tap edit s
    stack grow
      s.name bold
      s.class "fee" s.fee "discount" s.discount faint
    if count(s.payment month) > 0
      "Paid" last(s.payment.at) color good
    else
      button "Paid" tap add payment student = s, amount = s.fee - s.discount
form student, "Add student"
