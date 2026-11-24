app "Home expenses" home mint
table expense amount money, category pick Food|Bills|Fuel|Kids|Other, note text?
table budget category pick Food|Bills|Fuel|Kids|Other, limit money
remind "Pay recurring bills" monthly on 1 at 9:00
stat sum(expense.amount month), "spent this month"
"This month by category" head
share options expense.category, sum(expense.amount month where category = it), it
form expense, "Add expense"
"Budgets" head
each options expense.category as c
  row card
    c bold grow
    sum(expense.amount month where category = c) "of" sum(budget.limit where category = c)
    if sum(expense.amount month where category = c) > sum(budget.limit where category = c) and sum(budget.limit where category = c) > 0
      "Over budget" bold color bad
form budget, "Set budget"
