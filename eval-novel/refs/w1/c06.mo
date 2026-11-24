app "Egg count" egg mint
table eggs day date = today, n num 0.. "Eggs collected", cracked num 0.. = 0
setting hens num 1.. = 12 "Hens"
setting price money = 40 "Price per egg (Rs)"
let mon = today - weekday(today) + 1
let wk = sum(eggs.n where day >= mon)
row gap 3
  stat wk, "eggs this week"
  stat fixed(wk / (hens * 7), 2), "per hen per day"
stat sum(eggs where day >= mon, (it.n - it.cracked) * price), "income this week (Rs)"
form eggs, "Add day"
"Eggs per day" head
daybars last 14 days, sum(eggs.n where day = it)
remind "Enter today's eggs" at 20:00
list eggs by day
