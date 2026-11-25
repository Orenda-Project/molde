app "Budget" wallet slate
table spend amount money, category pick Food|Bills|Travel|Fun|Health|Other = Food, note text?
setting budget money = 80000 "Monthly budget"
state m date = today
state cat text = ""
let spent = sum(spend.amount month of m)
let day = if(monthname(m) = monthname(today), monthday(today), monthdays(m))
monthnav m
goal spent, budget, "spent so far"
row gap 2
  stat round(spent / day), "daily average"
  stat round((budget - spent) / (monthdays(m) - day + 1)), "left per day"
  stat sum(spend.amount prev month where monthday(at) <= monthday(today)), "same point last month"
"Spending through the month" head
draw 100, 50
  line 0, 50, 100, 0 stroke edge
  poly stroke accent thick 2
    each days month of m
      pt 100 * monthday(it) / monthdays(m), 50 - 50 * clamp(sum(spend.amount month of m where at <= it) / budget, 0, 1)
"By category (tap to filter)" head
each spend month of m by category
  stack tap set cat = if(cat = it.key, "", it.key)
    row
      it.key grow
      round(sum(it.amount) * 100 / spent) "%" faint
      sum(it.amount) bold
    draw 100, 3
      rect 0, 0, 100 * sum(it.amount) / spent, 3 fill if(cat = it.key, accent, muted)
form spend, "Add expense"
each spend month of m where cat = "" or category = cat by day as g
  row
    g.key bold grow
    sum(g.amount) faint
  each g as r
    row card tap edit r swipe remove r
      r.category r.note grow
      r.amount bold
