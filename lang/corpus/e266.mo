app "Spending" wallet slate
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Health|Other = Other
"Spent this month" sum(spend.amount month) big
share spend month by category, sum(it.amount), it.key
form spend
log spend
"Connecting to a bank is not possible here; add spending by hand." faint
