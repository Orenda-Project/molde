app "Where it goes" wallet slate
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Health|Other = Other
state m date = today
monthnav m
"Spent this month" sum(spend.amount month of m) big
share spend month of m by category, sum(it.amount), it.key
form spend
list spend month of m by day
"A bank connection is not possible here; add spending by hand." faint
