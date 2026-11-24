app "Fuel gauge" bolt ocean
setting budget money = 50000 "Monthly budget"
table spend amount money, note text
let used = sum(spend.amount month)
let left = budget - used
let frac = clamp(left / budget, 0, 1)
draw 100, 60 width 240 middle
  arc 50, 55, 40, 270, 450 stroke soft thick 8
  arc 50, 55, 40, 270, 270 + 180 * frac stroke accent thick 8
  line 50, 55, 50 + 34 * sin(-90 + 180 * frac), 55 - 34 * cos(-90 + 180 * frac) stroke ink thick 2
  label 50, 50, left big
stat used, "burned this month"
"Remaining of" budget faint align center
form spend, "Add spend"
list spend by day
