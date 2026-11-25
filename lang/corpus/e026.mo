app "Pocket Money" coin mint
setting allowance money = 500 "Weekly allowance"
table kid name text
table entry kid ref kid, kind pick Allowance|Spent|Saved, amount money
remind "Saturday: give the weekly allowance" at 10:00 on sat
each kid as k
  let sv = sum(k.entry.amount where kind = Saved)
  stack card gap 1
    k.name head
    "Savings balance" sv big
    "Spent" sum(k.entry.amount where kind = Spent) "| Allowance given" sum(k.entry.amount where kind = Allowance) faint
    button "Give allowance" tap add entry kid = k, kind = Allowance, amount = allowance
form kid, "Add child"
form entry, "Log money"
