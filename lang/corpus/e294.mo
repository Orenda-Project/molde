app "Milk shop" milk ocean
table customer name text, rate money "Rate per litre"
table delivery customer ref customer, litres num 0..
table payment customer ref customer, amount money
state m date = today
monthnav m
count(customer) "customers," sum(delivery today, it.litres) "litres delivered today" head
each customer as c
  let bill = sum(c.delivery month of m, it.litres) * c.rate
  stack card gap 1
    row
      c.name bold grow
      "Bill" bill bold
    "Paid" sum(c.payment.amount month of m) ", left" bill - sum(c.payment.amount month of m) faint
    row gap 1
      each [0.5, 1, 2] as v
        button v "L" tap add delivery customer = c, litres = v
form customer, "Add customer"
form payment, "Payment received"
log delivery month of m
