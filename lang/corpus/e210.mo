app "Meals and mood" smile plum
table meal what text, kind pick Breakfast|Lunch|Dinner|Snack, feel num 1..5 = 3 "How I felt after (1 low, 5 great)", note text?
"How I feel after each kind of meal" head
share meal by kind, avg(it.feel), it.key
"After each dish" head
share meal by what, avg(it.feel), it.key
form meal, "Log a meal"
list meal by day
