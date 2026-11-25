app "Weight" scale ocean
table weigh kg num 20..300 unit "kg"
last(weigh.kg) "kg" big
"Change this month" last(weigh.kg) - first(weigh.kg month) "kg" faint
trend weigh last 30 days, it.kg
form weigh, "Add weight"
list weigh
