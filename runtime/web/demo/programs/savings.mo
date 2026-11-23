app "Savings" coin mint
table deposit amount money, note text?
setting goal money = 100000 "Savings goal"
state adding bool = no
state d new deposit
let total = sum(deposit.amount)
let p = clamp(total / goal, 0, 1)
row gap 4 align center
  draw 40, 120 width 72
    rect 14, 6, 12, 92 fill soft radius 6
    rect 14, 98 - 92 * p, 12, 92 * p fill accent radius 6
    circle 20, 106, 12 fill accent
  stack grow gap 1
    "Saved so far" color muted
    "Rs" total big
    round(p * 100) "% of Rs" goal color muted tap edit goal
    if total >= goal
      "Goal reached" bold color good
    else
      "Rs" goal - total "to go" bold
"Add to savings" head
row gap 1
  button "+ 1,000" fill accent grow tap add deposit amount = 1000
  button "+ 5,000" grow tap add deposit amount = 5000
  button if(adding, "Close", "Other") grow tap set adding = not adding
if adding
  stack card gap 3
    field d
    button "Save deposit" fill accent tap save d then set adding = no
stack card gap 2
  row
    "Last 6 months" head grow
    "Rs" sum(deposit.amount month) "this month" faint
  row gap 1 align end
    each [5, 4, 3, 2, 1, 0]
      stack grow gap 1 align center
        round(sum(deposit.amount month of addmonths(today, 0 - it)) / 1000) size tiny color muted
        draw 10, 56
          rect 0, 0, 10, 56 fill soft radius 3
          rect 0, 56 - 56 * clamp(sum(deposit.amount month of addmonths(today, 0 - it)) / maxof([5, 4, 3, 2, 1, 0], sum(deposit.amount month of addmonths(today, 0 - it))), 0, 1), 10, 56 * clamp(sum(deposit.amount month of addmonths(today, 0 - it)) / maxof([5, 4, 3, 2, 1, 0], sum(deposit.amount month of addmonths(today, 0 - it))), 0, 1) fill if(it = 0, accent, muted) radius 3
  "Thousands of rupees per month," monthname(addmonths(today, -5)) "to" monthname(today) faint
"Deposits" head
if count(deposit) = 0
  "Nothing saved yet. Tap + 1,000 to make the first deposit." color muted
each deposit sort at desc top 12 as r
  row card tap edit r swipe remove r
    stack grow gap 0
      r.note
      r.at faint
    "Rs" r.amount bold
