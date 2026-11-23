app "Bike fund" bike mint
setting price money = 60000 "Bike price"
setting monthly money = 5000 "Monthly deposit"
table deposit amount money
let saved = sum(deposit.amount)
let left = if(saved < price, price - saved, 0)
saved "of" price big
"Remaining" left head
draw 100, 6
  rect 0, 0, 100, 6 fill soft radius 3
  rect 0, 0, 100 * clamp(left / price, 0, 1), 6 fill accent radius 3
"At this pace you reach the goal on" addmonths(today, 0 - floor(0 - left / monthly)) faint
button "Add monthly deposit" tap add deposit amount = monthly
form deposit
log deposit
