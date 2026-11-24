app "Udhaar khata" book ocean
table customer name text
table credit customer ref customer, amount money, note text?
table payment customer ref customer, amount money
remind "Collect udhaar" at 17:00 on fri
stat sum(customer, sum(it.credit.amount) - sum(it.payment.amount)), "total outstanding"
form customer, "Add customer"
each customer sort sum(it.credit.amount) - sum(it.payment.amount) desc as c empty "No customers yet"
  row card swipe remove c
    c.name bold grow
    sum(c.credit.amount) - sum(c.payment.amount) bold color if(sum(c.credit.amount) > sum(c.payment.amount), bad, good)
"Took on credit" head
form credit, "Add credit"
"Payment made" head
form payment, "Add payment"
