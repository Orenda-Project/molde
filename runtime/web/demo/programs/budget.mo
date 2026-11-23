app "Budget" wallet slate
table spend what text, amount money, category pick Groceries|Bills|Transport|Eating_out|Health|Other = Groceries
setting budget money = 80000 "Monthly budget"
state m date = today
state cat text = ""
let spent = sum(spend.amount month of m)
let day = if(monthname(m) = monthname(today), monthday(today), monthdays(m))
let left = budget - spent
row align center gap 1
  button "<" tap set m = addmonths(m, -1)
  text monthname(m) bold grow align center
  button ">" tap set m = addmonths(m, 1)
stack card gap 3
  text if(left >= 0, "Left to spend", "Over budget by") faint
  row gap 1 align end
    text "Rs" abs(left) big color if(left >= 0, ink, bad)
    text "of Rs" budget color muted tap edit budget
  draw 100, 4
    rect 0, 0, 100, 4 fill soft radius 2
    rect 0, 0, 100 * clamp(spent / budget, 0, 1), 4 fill if(spent > budget, bad, accent) radius 2
    rect 100 * day / monthdays(m), 0, 0.6, 4 fill ink
  row
    text "Rs" spent "spent" faint grow
    text "Even pace: day" day "of" monthdays(m) faint
  if monthname(m) = monthname(today) and left > 0
    stack fill soft pad 2 radius 10
      text "Rs" round(left / (monthdays(m) - day + 1)) "a day keeps you on budget for the last" monthdays(m) - day + 1 "days."
  divider
  row gap 3
    stack gap 0
      text "Daily average" faint
      text "Rs" round(spent / day) head
      text "over" day "days" faint
    stack gap 0
      text "Same day last month" faint
      text "Rs" sum(spend.amount month of addmonths(m, -1) where monthday(at) <= day) head
      text "by day" day faint
    stack gap 0
      text "Expenses" faint
      text count(spend month of m) head
      text "this month" faint
stack card gap 3
  text "Spending through the month" head
  draw 100, 56
    line 0, 56, 100, 0 stroke muted thick 0.4
    poly stroke accent thick 1.4
      each days month of m
        if monthday(it) <= day
          pt 100 * monthday(it) / monthdays(m), 56 - 56 * clamp(sum(spend.amount month of m where at <= it) / budget, 0, 1)
  text "Thick line: spent so far. Thin line: an even pace to the budget." faint
stack card gap 3
  row
    text "By category" head grow
    text "Tap to filter" faint
  each spend month of m by category sort amount desc
    stack gap 1 tap set cat = if(cat = it.key, "", it.key)
      row
        text it.key grow bold
        text round(sum(it.amount) * 100 / spent) "%" faint
        text "Rs" sum(it.amount)
      draw 100, 2
        rect 0, 0, 100, 2 fill soft radius 1
        rect 0, 0, 100 * sum(it.amount) / spent, 2 fill if(cat = it.key, accent, muted) radius 1
form spend, "Add expense"
row
  text if(cat = "", "All expenses", cat) head grow
  if cat != ""
    button "Show all" tap set cat = ""
each spend month of m where cat = "" or category = cat by day as g
  row
    text g.key bold faint grow
    text "Rs" sum(g.amount) faint
  each g as r
    row card tap edit r swipe remove r
      stack grow gap 0
        text r.what
        text r.category faint
      text "Rs" r.amount bold
