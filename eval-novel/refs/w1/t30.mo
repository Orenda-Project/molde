app "Kabari" scale slate
table purchase item pick Iron|Paper|Plastic|Copper, kg num 0.., rate money "Rate per kg", seller text?
table sale item pick Iron|Paper|Plastic|Copper, kg num 0.., rate money "Sale rate per kg"
let spent = sum(purchase, it.kg * it.rate)
let sold = sum(sale, it.kg * it.rate)
row gap 3
  stat spent, "total spent"
  stat sold, "total sales"
form purchase, "Add purchase"
each purchase as p empty "No purchases yet"
  row card tap edit p swipe remove p
    stack grow gap 0
      p.item p.kg "kg" bold
      p.seller faint
    p.kg * p.rate bold
"Selling later" head
form sale, "Add sale"
each options purchase.item as o
  row card
    o bold grow
    "profit" sum(sale where item = o, it.kg * it.rate) - sum(sale where item = o, it.kg) * sum(purchase where item = o, it.kg * it.rate) / max(sum(purchase.kg where item = o), 1) bold
