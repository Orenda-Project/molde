app "Water" drop ocean
table drink ml num 1..5000 unit "ml", kind pick Water|Tea|Juice|Milk = Water
setting goal num = 2000 "Daily goal (ml)"
let ml = sum(drink.ml today)
statcard ml, "ml of" goal "today", goal
quick drink, ml, [250, 150, 500]
section "Today", plural(count(drink today), "drink")
  list drink today, "Nothing yet today. Tap 250 when you have a glass."
section "Last 7 days", "goal met on" count(days last 7 days, sum(drink.ml on it) >= goal) "of 7 days"
  goalbars last 7 days, sum(drink.ml on it), goal
