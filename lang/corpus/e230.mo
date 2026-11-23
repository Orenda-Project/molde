app "Electricity units" bolt ocean
table bill units num 0.., cost money?
"This month" sum(bill.units month) "units" big
bars bill last 12 months by month, sum(it.units), it.key
form bill
log bill
