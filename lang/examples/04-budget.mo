app "Budget" wallet slate
table spend what text, amount money, category pick Food|Bills|Travel|Fun|Health
setting budget money = 80000 "Monthly budget"
state m date = today
state cat text = ""
let spent = sum(spend.amount month of m)
monthnav m
text if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big
goal spent, budget, "spent"
text "Safe to spend" round((budget - spent) / (monthdays(m) - monthday(today) + 1)) "a day. Last month:" sum(spend.amount prev month) faint
draw 100, 50
  line 0, 50, 100, 0 stroke edge
  poly stroke accent thick 2
    each days month of m
      pt 100 * monthday(it) / monthdays(m), 50 - 50 * clamp(sum(spend.amount month of m where at <= it) / budget, 0, 1)
each spend month of m by category
  stack tap set cat = if(cat = it.key, "", it.key)
    row
      text it.key grow
      text sum(it.amount) bold
    draw 100, 3
      rect 0, 0, 100 * sum(it.amount) / spent, 3 fill if(cat = it.key, accent, muted)
form spend
log spend month of m where cat = "" or category = cat
