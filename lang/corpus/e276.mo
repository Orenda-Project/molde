app "Pocket money" coin mint
table kid name text
table move kid ref kid, amount money, kind pick Got|Spent, note text?
each kid as k
  row card tap edit k
    k.name bold grow
    sum(k.move.amount where kind = Got) - sum(k.move.amount where kind = Spent) big
form kid, "Add child"
form move, "Add entry"
list move by day
