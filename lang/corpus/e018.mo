app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500]
"Days goal met this week:" countof(days last 7 days, sum(drink.ml on it) >= goal) faint
daybars last 7 days, sum(drink.ml on it)
list drink
