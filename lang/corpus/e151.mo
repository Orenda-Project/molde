app "Vacation" plane ocean
table flight route text, day date, cost money
table hotel name text, nights num 1.., cost money
table pack item text, packed bool
table doc name text, ready bool
setting trip_days num = 7 "Trip days"
setting budget money = 200000 "Total budget"
let spent = sum(flight.cost) + sum(hotel.cost)
screen plan "Plan" plane
  goal spent, budget, "booked", ""
  "Budget per day" round(budget / trip_days) head
  "Left per day" round((budget - spent) / trip_days) faint
  list flight
  form flight, "Add flight"
  list hotel
  form hotel, "Add hotel"
screen packing "Packing" bag
  count(pack where packed = no) "left to pack" head
  each pack sort at as p
    row card swipe remove p
      toggle p.packed
      p.item grow
  form pack, "Add item"
screen docs "Documents" note
  each doc as d
    row card swipe remove d
      toggle d.ready
      d.name grow
  form doc, "Add document"
