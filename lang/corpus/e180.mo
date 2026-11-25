app "Committee" users plum
table member name text, ord num 1..60
table pay member ref member, amount money
table payout member ref member
setting contribution money = 5000 "Monthly contribution"
let turn_no = count(payout) % count(member) + 1
"This month's turn" head
each member where ord = turn_no as m
  stack card gap 1
    m.name big
    "gets" contribution * count(member) faint
    button "Pot given" tap add payout member = m
count(pay month) "of" count(member) "have paid this month" head
each member sort ord as m
  row card gap 1
    m.ord bold
    m.name grow
    if(count(m.payout) > 0, "Received", "") color good faint
    if count(m.pay month) > 0
      "Paid" color good
    else
      button "Paid" tap add pay member = m, amount = contribution
form member, "Add member"
