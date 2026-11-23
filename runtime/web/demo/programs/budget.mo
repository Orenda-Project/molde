app "Budget" wallet slate
table spend what text, amount money, category pick Groceries|Bills|Transport|Eating_out|Health|Other = Groceries
setting budget money = 80000 "Monthly budget"
state m date = today
state cat text = ""
state adding bool = no
state d new spend
let spent = sum(spend.amount month of m)
let now_month = monthname(m) = monthname(today)
let day = if(now_month, monthday(today), monthdays(m))
let left = budget - spent
row align center gap 1
  button "<" tap set m = addmonths(m, -1)
  monthname(m) bold grow align center
  if now_month
    box width 44
  else
    button ">" tap set m = addmonths(m, 1)
stack card gap 3
  if(left >= 0, "Left to spend", "Over budget by") color muted
  row gap 1 align end
    "Rs" abs(left) big color if(left >= 0, ink, bad)
    "of Rs" budget color muted tap edit budget
  draw 100, 4
    rect 0, 0, 100, 4 fill soft radius 2
    rect 0, 0, 100 * clamp(spent / budget, 0, 1), 4 fill if(spent > budget, bad, accent) radius 2
    rect 100 * day / monthdays(m), 0, 0.6, 4 fill ink
  row
    "Rs" spent "spent" faint grow
    "Day" day "of" monthdays(m) faint
  if now_month and left > 0
    stack fill soft pad 2 radius 10
      "Rs" round(left / (monthdays(m) - day + 1)) "a day keeps you on budget for the rest of the month."
  if now_month
    button if(adding, "Close", "Add expense") fill if(adding, soft, accent) tap set adding = not adding
  if adding
    field d
    button "Save expense" fill accent tap save d then set adding = no
stack card gap 2
  "Spending through the month" head
  row gap 3
    row gap 1
      draw 16, 4 width 16
        rect 0, 1, 16, 2 fill accent
      "Spent so far" faint
    row gap 1
      draw 16, 4 width 16
        rect 0, 1.5, 16, 1 fill muted
      "Even pace" faint
  draw 110, 72
    line 22, 6, 108, 6 stroke edge thick 0.3
    line 22, 32, 108, 32 stroke edge thick 0.3
    line 22, 58, 108, 58 stroke edge thick 0.3
    label 10, 6, budget size tiny color muted
    label 10, 32, budget / 2 size tiny color muted
    label 10, 58, "0" size tiny color muted
    line 22, 58, 108, 6 stroke muted thick 0.4
    poly stroke accent thick 1.4
      each days month of m
        if monthday(it) <= day
          pt 22 + 86 * monthday(it) / monthdays(m), 58 - 52 * clamp(sum(spend.amount month of m where at < it + 1) / budget, 0, 1)
    circle 22 + 86 * day / monthdays(m), 58 - 52 * clamp(spent / budget, 0, 1), 1.6 fill accent
    label 24, 67, "1" size tiny color muted
    label 65, 67, round(monthdays(m) / 2) size tiny color muted
    label 106, 67, monthdays(m) size tiny color muted
  "Rs" spent "by day" day "against an even pace of Rs" round(budget * day / monthdays(m)) faint
stack card gap 3
  row
    "By category" head grow
    "Tap to filter" faint
  if spent = 0
    "No spending this month yet." color muted
  each spend month of m by category sort amount desc
    stack gap 1 tap set cat = if(cat = it.key, "", it.key)
      row
        it.key grow bold
        round(sum(it.amount) * 100 / spent) "%" faint
        "Rs" sum(it.amount)
      draw 100, 2
        rect 0, 0, 100, 2 fill soft radius 1
        rect 0, 0, 100 * sum(it.amount) / spent, 2 fill if(cat = it.key, accent, muted) radius 1
row gap 2 align center
  if(cat = "", "All expenses", cat) head grow
  if cat != ""
    button "Show all" tap set cat = ""
if count(spend month of m where cat = "" or category = cat) = 0
  "Nothing here. Expenses you add show up here, newest first." color muted
each spend month of m where cat = "" or category = cat by day as g
  row
    g.key bold faint grow
    "Rs" sum(g.amount) faint
  each g as r
    row card tap edit r swipe remove r
      stack grow gap 0
        r.what
        r.category faint
      "Rs" r.amount bold
