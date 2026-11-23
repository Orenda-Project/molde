app "Shop Day Summary" bag slate
table sale item text, amount money, pay pick Cash|Card|Easypaisa|JazzCash = Cash
remind "Check today's sales summary" at 21:00
stat sum(sale.amount today), "sales today"
"By payment type" head
each options sale.pay
  row
    text it grow
    sum(sale.amount today where pay = it) bold
"By item" head
each sale today by item
  row
    it.key grow
    sum(it.amount) bold
form sale, "Add sale"
