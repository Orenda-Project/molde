app "Udhaar book" book mint
table entry customer text, kind pick Took|Paid_back, amount money "Amount (Rs)", day date = today
state q text
let pending = sum(entry where kind = Took, it.amount) - sum(entry where kind = Paid_back, it.amount)
stat pending, "total pending (Rs)"
form entry, "Add entry"
field q "Find someone by name"
"Who owes" head
each entry where has(customer, q) by customer
  row card
    it.key bold grow
    sum(it, if(it.kind = Took, it.amount, 0 - it.amount)) bold
list entry where has(customer, q) by day
