app "Goat feed" paw mint
table feed day date = today, fodder num 0.. unit "kg", wanda num 0.. unit "kg" "Concentrate", cost money
table vaccine day date = today, note text? "Which vaccine"
stat sum(feed.cost), "total feed cost"
"This month" sum(feed.cost where day >= today - monthday(today) + 1) faint
form feed, "Add feed entry"
list feed by day
"Vaccinations" head
form vaccine, "Add vaccination date"
list vaccine
