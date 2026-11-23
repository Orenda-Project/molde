app "Savings" coin mint
table deposit amount money, note text?
setting goal money = 100000 "Savings goal"
let total = sum(deposit.amount)
let p = clamp(total / goal, 0, 1)
row gap 3
  draw 40, 120 width 60
    rect 14, 6, 12, 92 fill soft radius 6
    rect 14, 98 - 92 * p, 12, 92 * p fill accent radius 6
    circle 20, 106, 12 fill accent
  stack grow
    total big
    round(p * 100) "% of" goal faint tap edit goal
    "This month" sum(deposit.amount month) faint
quick deposit, amount, [500, 1000, 5000]
form deposit
log deposit
