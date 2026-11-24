app "Budget" wallet slate
table spend what text, amount money, category pick Groceries|Bills|Transport|Eating_out|Health|Other = Groceries
setting budget money = 80000 "Monthly budget"
state m date = today
let spent = sum(spend.amount month of m)
topbar spend, "Add spending"
monthnav m
goal spent, budget, if(spent > budget, "over budget", "spent this month")
section "By category", monthname(m)
  share spend month of m by category, sum(it.amount), it.key
section "Spending per day"
  daybars month of m, sum(spend.amount on it)
list spend month of m by day, "Nothing spent this month."
