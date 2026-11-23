app "Milk" milk ocean
table customer name text, rate money "Rate per litre"
table delivery customer ref customer, litres num 0..
table payment customer ref customer, amount money
"Money due" sumof(customer, sumof(it.delivery, it.litres) * it.rate - sum(it.payment.amount)) big
each customer as c
  stack card gap 1
    row
      c.name bold grow
      "Due" sumof(c.delivery, it.litres) * c.rate - sum(c.payment.amount) bold
    "Today" sum(c.delivery.litres today) "litres" faint
    row gap 1
      each [0.5, 1, 2] as v
        button v "L" tap add delivery customer = c, litres = v
      button "Paid" tap edit c
form customer, "Add customer"
form payment, "Add payment"
log delivery
