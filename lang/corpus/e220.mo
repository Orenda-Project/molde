app "Household" home mint
table expense what text, amount money, category pick Rent|Groceries|School|Transport|Medicine|Eid_savings, note text?
setting lim_rent money = 30000 "Rent limit"
setting lim_groceries money = 20000 "Groceries limit"
setting lim_school money = 10000 "School limit"
setting lim_transport money = 5000 "Transport limit"
setting lim_medicine money = 3000 "Medicine limit"
setting lim_eid money = 5000 "Eid savings limit"
state m date = today
monthnav m
"Spent this month" sum(expense.amount month of m) big
each options expense.category as k
  let spent = sum(expense.amount month of m where category = k)
  let lim = if(k = Rent, lim_rent, if(k = Groceries, lim_groceries, if(k = School, lim_school, if(k = Transport, lim_transport, if(k = Medicine, lim_medicine, lim_eid)))))
  stack gap 1
    row
      text k bold grow color if(spent > lim, bad, ink)
      text spent "of" lim
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * clamp(spent / lim, 0, 1), 4 fill if(spent > lim, bad, accent) radius 2
form expense
log expense month of m
