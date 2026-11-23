app "Weekly spend" wallet slate
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Other = Food
"This week" sum(spend.amount week) big
share spend week by category, sum(it.amount), it.key
daybars last 7 days, sum(spend.amount on it)
form spend
log spend week
