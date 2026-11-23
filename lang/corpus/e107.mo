app "Protein" egg mint
table meal food text, grams num 0..300 unit "g"
setting goal_g num = 80 "Daily protein (g)"
goal sum(meal.grams today), goal_g, "protein today", "g"
daybars last 7 days, sum(meal.grams on it)
form meal
list meal by day
