app "Electricity" bolt plum
table bill appliance text, amount money
let total = sum(bill.amount)
draw width 220
  each bill sort at as b
    arc 50, 50, 25, 360 * sumof(bill, if(it.at < b.at, it.amount, 0)) / total, 360 * (sumof(bill, if(it.at < b.at, it.amount, 0)) + b.amount) / total stroke if(index % 5 = 0, accent, if(index % 5 = 1, good, if(index % 5 = 2, warn, if(index % 5 = 3, bad, muted)))) thick 50
"Total bill" total big
each bill sort at as b
  row
    b.appliance grow
    round(b.amount * 100 / total) "%" bold
form bill, "Add appliance"
