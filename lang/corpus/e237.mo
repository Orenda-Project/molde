app "Business" bag slate
table sale who text, amount money, paid bool
table cost what text, amount money
state m date = today
monthnav m
"Profit this month" sum(sale.amount month of m) - sum(cost.amount month of m) big
row gap 2
  stat sum(sale.amount month of m), "sales"
  stat sum(cost.amount month of m), "costs"
  stat sum(sale.amount where paid = no), "still owed to me"
"Unpaid sales" head
each sale where paid = no as s
  row card
    toggle s.paid
    s.who grow
    s.amount
form sale, "Add sale"
form cost, "Add cost"
log cost month of m
