app "Work orders" bag slate
table client name text, phone text?
table order client ref client, item text, amount money, paid bool, due date
each client as c
  let owed = sum(c.order.amount where paid = no)
  stack card gap 1
    row
      c.name bold grow
      owed bold color if(owed > 0, bad, good)
    each c.order where paid = no sort due as o
      row gap 1
        toggle o.paid
        o.item grow
        o.amount
        if(o.due < today, "late", "") color bad
"Total owed to me" sum(order.amount where paid = no) head
form client, "Add client"
form order, "Add order"
"Sending WhatsApp reminders is not possible here." faint
