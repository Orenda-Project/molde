app "Savings" coin mint
table deposit amount money, note text?
setting monthly money = 5000 "Saved each month"
setting goal money = 100000
let total = sum(deposit.amount)
let left = goal - total
let nm = if(left <= 0, 0, floor(left / monthly) + if(left % monthly > 0, 1, 0))
text total "of" goal big
goal total, goal, "saved"
if(left <= 0, "Goal reached", "You reach it around") if(left <= 0, "", monthname(addmonths(today, nm))) head
quick deposit, amount, [5000]
form deposit
log deposit
