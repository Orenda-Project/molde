app "Egg Sales" egg mint
table sale eggs num 1.., amount money
stat sum(sale.amount today), "today"
daybars last 7 days, sum(sale.amount on it)
form sale, "Add sale"
log sale
