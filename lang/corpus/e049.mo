app "Kids Food" apple mint
table food child text, what text, sugar num 0..200 unit "g"
setting limit num = 25 "Sugar limit per day (g)"
goal sum(food.sugar today), limit, "sugar today", "g"
form food, "Add food"
"Sugar by day" head
daybars last 7 days, sum(food.sugar on it)
log food
