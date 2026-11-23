app "Rickshaw" car slate
table fuel amount money, litres num? 0..
table income amount money
"Net today" sum(income.amount today) - sum(fuel.amount today) big
row gap 2
  stat sum(income.amount week), "income this week"
  stat sum(fuel.amount week), "petrol this week"
  stat sum(income.amount week) - sum(fuel.amount week), "net this week"
form income, "Add income"
form fuel, "Add petrol"
daybars last 7 days, sum(income.amount on it) - sum(fuel.amount on it)
log income
log fuel
