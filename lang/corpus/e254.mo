app "Marriage fund" gift plum
table deposit amount money, note text?
setting goal money = 2000000
setting monthly money = 10000 "Monthly saving"
let total = sum(deposit.amount)
let p = clamp(total / goal, 0, 1)
let nm = if(goal <= total, 0, floor((goal - total) / monthly) + if((goal - total) % monthly > 0, 1, 0))
row gap 3
  draw 40, 120 width 60
    rect 14, 6, 12, 92 fill soft radius 6
    rect 14, 98 - 92 * p, 12, 92 * p fill accent radius 6
    circle 20, 106, 12 fill accent
  stack grow
    text total big
    round(p * 100) "% of" goal faint
    "At this pace:" monthname(addmonths(today, nm)) faint
quick deposit, amount, [5000, 10000]
form deposit
log deposit
