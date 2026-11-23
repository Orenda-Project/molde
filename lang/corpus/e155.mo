app "Bakery books" bread plum
table ingredient name text, qty num 0.., low num 0.. = 2, unit_cost money
table buy ingredient ref ingredient, qty num 0.., cost money
table sale item text, amount money
table waste what text, cost money
screen daily "Today" bread
  stat sum(sale.amount today), "sales today"
  form sale, "Add sale"
  log sale today
screen stock "Stock" package
  each ingredient sort qty as i
    row card gap 1 tap edit i
      i.name bold grow color if(i.qty <= i.low, warn, ink)
      button "-" tap set i.qty = i.qty - 1
      i.qty bold
      button "+" tap set i.qty = i.qty + 1
  form ingredient, "Add ingredient"
  form buy, "Bought"
screen wasted "Wastage" tag
  stat sum(waste.cost week), "wasted this week"
  form waste, "Add wastage"
  list waste
screen report "Weekly profit" chart
  stat sum(sale.amount week), "sales this week"
  stat sum(buy.cost week), "ingredients bought"
  stat sum(waste.cost week), "wastage (already in purchases)"
  "Profit" sum(sale.amount week) - sum(buy.cost week) big color if(sum(sale.amount week) < sum(buy.cost week), bad, good)
  "Last week" sum(sale.amount prev week) - sum(buy.cost prev week) faint
  daybars last 7 days, sum(sale.amount on it)
