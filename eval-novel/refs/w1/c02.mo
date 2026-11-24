app "Solar log" sun ocean
table output day date = today, kwh num 0.. unit "kWh", weather pick Sunny|Cloudy|Rainy
let mon = today - monthday(today) + 1
let wk = today - weekday(today) + 1
stat max(output.kwh), "best day so far (kWh)"
"This month" sum(output.kwh where day >= mon) "kWh" faint
form output, "Add today's output"
"Last 14 days" head
daybars last 14 days, sum(output.kwh where day = it)
"kWh per week, last 8 weeks" head
bars 1..8, sum(output.kwh where day >= wk - 7 * (8 - it) and day < wk - 7 * (7 - it)), join("W", it)
list output
