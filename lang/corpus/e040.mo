app "Brothers Split" users slate
table brother name text
table spend payer ref brother, amount money, what text
let total = sum(spend.amount month)
let share = total / count(brother)
"Month total" total big
each brother as b
  let bal = sum(b.spend.amount month) - share
  row card
    b.name bold grow
    if(bal >= 0, "gets back", "owes") abs(bal) bold color if(bal >= 0, good, bad)
form brother, "Add brother"
form spend, "Add expense"
list spend by day
