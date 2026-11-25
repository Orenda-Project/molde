app "Money" wallet slate
table income what text, amount money
table spend what text, amount money, category pick Food|Bills|Rent|Travel|Fun|Other = Food
setting goal money = 100000 "Savings goal"
let t = sum(spend.amount month)
let a1 = 360 * sum(spend.amount month where category = Food) / t
let a2 = a1 + 360 * sum(spend.amount month where category = Bills) / t
let a3 = a2 + 360 * sum(spend.amount month where category = Rent) / t
let a4 = a3 + 360 * sum(spend.amount month where category = Travel) / t
let a5 = a4 + 360 * sum(spend.amount month where category = Fun) / t
let saved = sum(income.amount) - sum(spend.amount)
row gap 2
  stat sum(income.amount month), "income this month"
  stat t, "spent this month"
  stat sum(income.amount month) - t, "left this month"
goal saved, goal, "saved towards the goal"
"Spending by category" head
draw width 200
  circle 50, 50, 36 stroke soft thick 16
  arc 50, 50, 36, 0, a1 stroke accent thick 16
  arc 50, 50, 36, a1, a2 stroke good thick 16
  arc 50, 50, 36, a2, a3 stroke warn thick 16
  arc 50, 50, 36, a3, a4 stroke bad thick 16
  arc 50, 50, 36, a4, a5 stroke ink thick 16
  arc 50, 50, 36, a5, 360 stroke muted thick 16
share spend month by category, sum(it.amount), it.key
form income, "Add income"
form spend, "Add spending"
