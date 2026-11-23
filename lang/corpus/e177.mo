app "Cousin bills" wallet slate
table bill name text, amount money, paid bool, note long?
"Unpaid bills" sum(bill.amount where paid = no) big
each bill where paid = no as b
  row card gap 1 tap edit b
    b.name bold grow
    b.amount
    toggle b.paid
form bill, "Add bill"
remind "Message cousin about the bills" at 20:00 on sun
