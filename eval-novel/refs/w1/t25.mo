app "Rent" home slate
table tenant name text, flat text, rent money, due num 1..28 "Due day", elec money = 0 "Electricity share", paid bool
let expected = sum(tenant, it.rent + it.elec)
let collected = sum(tenant where paid = yes, it.rent + it.elec)
row gap 3
  stat expected, "expected"
  stat collected, "collected"
goal collected, expected, "collected this month"
form tenant, "Add tenant"
each tenant sort it.flat empty "No tenants yet"
  row card tap edit it
    stack grow gap 0
      it.name bold
      "Flat" it.flat "due on" it.due faint
    it.rent + it.elec bold
    toggle it.paid
"Not paid yet" head
each tenant where paid = no
  text it.name it.rent + it.elec color bad
button "New month" tap set all tenant.paid = no
