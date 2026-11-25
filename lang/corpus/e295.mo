app "Shared bills" users ocean
table person name text
table bill what text, amount money, paid ref person
let share = sum(bill.amount) / count(person)
"Total" sum(bill.amount) "," share "each" head
each person as p
  let bal = sum(p.bill.amount) - share
  row card
    p.name bold grow
    if(bal >= 0, "gets back", "owes") abs(bal) color if(bal >= 0, good, bad)
form person, "Add person"
form bill, "Add bill"
list bill
"Seeing the list live on two phones is not possible; this works on one phone." faint
