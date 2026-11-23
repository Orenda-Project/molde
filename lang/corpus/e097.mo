app "Bakery" bread mint
table sale item text, qty num 1.., amount money
stat sum(sale.amount today), "sales today"
count(sale today) "sales" faint
form sale, "Add sale"
log sale
