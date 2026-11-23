app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2500 "Daily target (ml)"
goal sum(drink.ml today), goal, "today", "ml"
remind "Drink some water" every 90m from 8:00 to 22:00
quick drink, ml, [250, 500]
form drink
"Daily totals" head
daybars last 7 days, sum(drink.ml on it)
"Weekly average" round(sum(drink.ml last 7 days) / 7) "ml a day" faint
list drink by day
