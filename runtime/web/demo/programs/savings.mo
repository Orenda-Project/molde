app "Savings" coin mint
table deposit amount money, note text?
setting goal money = 100000 "Savings goal"
state adding bool = no
state d new deposit
let total = sum(deposit.amount)
let p = clamp(total / goal, 0, 1)
let mon(d date) = if(month(d) = 1, "Jan", if(month(d) = 2, "Feb", if(month(d) = 3, "Mar", if(month(d) = 4, "Apr", if(month(d) = 5, "May", if(month(d) = 6, "Jun", if(month(d) = 7, "Jul", if(month(d) = 8, "Aug", if(month(d) = 9, "Sep", if(month(d) = 10, "Oct", if(month(d) = 11, "Nov", "Dec")))))))))))
row gap 4 align center
  draw 40, 120 width 72
    rect 14, 6, 12, 92 fill soft radius 6
    rect 14, 98 - 92 * p, 12, 92 * p fill accent radius 6
    circle 20, 106, 12 fill accent
  stack grow gap 1
    "Saved so far" color muted
    total big
    round(p * 100) "% of" goal color muted tap edit goal
    if total >= goal
      "Goal reached" bold color good
    else
      text goal - total "to go" bold
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
    sum(deposit.amount month) "this month" faint
  plot 0..6, 0..max(1000, max([5, 4, 3, 2, 1, 0], sum(deposit.amount month of addmonths(today, 0 - it)))) axes gridlines
    each [5, 4, 3, 2, 1, 0]
      rect index + 0.15, 0, 0.7, sum(deposit.amount month of addmonths(today, 0 - it)) fill if(it = 0, accent, muted) radius 3
      tick index + 0.5, mon(addmonths(today, 0 - it))
  "Rupees saved each month; this month in colour" faint
"Deposits" head
each deposit sort at desc top 12 as r empty "Nothing saved yet. Tap + 1,000 to make the first deposit."
  row card tap edit r swipe remove r
    stack grow gap 0
      r.note
      r.at faint
    r.amount bold
