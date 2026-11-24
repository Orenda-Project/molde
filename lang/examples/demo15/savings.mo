app "Savings" coin mint
table deposit amount money, note text?
setting goal money = 100000 "Savings goal"
let total = sum(deposit.amount)
topbar "Savings", deposit, "Other amount"
statcard total, "saved of" goal, goal
quick deposit, amount, [1000, 5000]
section "Last 7 days", "this month:" sum(deposit.amount month)
  goalbars last 7 days, sum(deposit.amount on it), goal / 30
section "Deposits"
  list deposit top 12, "Nothing saved yet. Tap 1000 to make the first deposit."
