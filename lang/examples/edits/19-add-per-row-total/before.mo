app "Split" users ocean
table friend name text
table cost what text, amount money, paid ref friend
let share = sum(cost.amount) / count(friend)
text "Total" sum(cost.amount) "," share "each" head
each friend as f
  let bal = sum(f.cost.amount) - share
  row card
    text f.name bold grow
    text if(bal >= 0, "gets back", "owes") abs(bal) color if(bal >= 0, good, bad)
form friend, "Add friend"
form cost, "Add cost"
list cost
