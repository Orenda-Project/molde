app "My Shop" bag slate
table sale what text, amount money, cost money = 0
table expense what text, amount money
let profit = sum(sale.amount month) - sum(sale.cost month) - sum(expense.amount month)
stat sum(sale.amount today), "sales today"
row gap 3
  stat sum(sale.amount week), "this week"
  stat sum(sale.amount month), "this month"
if(profit >= 0, "Profit this month", "Loss this month") abs(profit) head color if(profit >= 0, good, bad)
daybars last 7 days, sum(sale.amount on it)
form sale, "Add sale"
form expense, "Add expense"
list sale by day
