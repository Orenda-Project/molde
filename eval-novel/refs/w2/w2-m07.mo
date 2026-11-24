app "Road trip" car ocean
table stop place text, on date
table expense payer text, amount money, note text?
table pack item text, packed bool
setting km num = 400 "Distance (km)"
setting mileage num = 12 "Mileage (km per litre)"
setting petrol money = 270 "Petrol price per litre"
"Stops" head
form stop, "Add stop"
each stop sort on as s
  row card swipe remove s
    s.place bold grow
    s.on faint
"Expenses" head
row gap 2
  stat sum(expense.amount), "total"
  stat sum(expense.amount) / 4, "per person (4)"
form expense, "Add expense"
list expense
"Fuel cost" head
stat km / mileage * petrol, "fuel for the trip"
"Packing" head
form pack, "Add item"
each pack as p
  row card swipe remove p
    toggle p.packed
    p.item grow
