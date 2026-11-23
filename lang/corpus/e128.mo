app "Client payments" wallet slate
table client name text, phone text?
table due client ref client, amount money, pay_by date, paid bool
"Due now" sumof(due where paid = no, it.amount) big
each due where paid = no sort pay_by as d
  row card gap 1
    stack grow
      d.client.name bold
      "due" d.pay_by faint color if(d.pay_by < today, bad, muted)
    d.amount bold
    toggle d.paid
form client, "Add client"
form due, "Add payment due"
