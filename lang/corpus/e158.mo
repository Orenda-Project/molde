app "Dashboard" chart slate
table sale amount money, note text?
table expense amount money, note text?
let s = sum(sale.amount week)
let e = sum(expense.amount week)
row gap 2
  stat s, "sales this week"
  stat e, "expenses this week"
  stat s - e, "profit this week"
daybars last 7 days, sum(sale.amount on it) - sum(expense.amount on it)
form sale, "Add sale"
form expense, "Add expense"
