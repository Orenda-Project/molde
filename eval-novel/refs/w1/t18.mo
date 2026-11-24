app "Rickshaw" bus ocean
table shift day date = today, earned money, petrol money, hours num 0.5..24
let mon = today - weekday(today) + 1
let profit = sum(shift, it.earned - it.petrol)
row gap 3
  stat profit, "total profit"
  stat fixed(profit / sum(shift.hours), 0), "average per hour"
"This week" sum(shift where day >= mon, it.earned - it.petrol) bold
form shift, "Add day"
"Profit per week" head
bars 1..8, sum(shift where day >= mon - 7 * (8 - it) and day < mon - 7 * (7 - it), it.earned - it.petrol), join("W", it)
each shift as s
  row card tap edit s swipe remove s
    s.day bold grow
    "profit" s.earned - s.petrol bold
