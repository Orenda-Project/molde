app "Laundry" cloud ocean
table load clothes text, dropped date = today, pickup date, price money, collected bool
count(load where collected = no) "waiting at the laundry" big
stat sum(load.price month), "paid this month"
form load
each load where collected = no sort pickup
  row card
    it.clothes grow
    "pickup" it.pickup
    it.price bold
    toggle it.collected
log load where collected = yes
