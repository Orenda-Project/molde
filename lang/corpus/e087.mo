app "Home Energy" bolt slate
table reading meter num 0..
table appliance name text, watts num 1..10000, hours num 0..24
setting rate money = 40 "Cost per unit"
let used = last(reading.meter) - last(reading.meter prev week)
"This week" used "units" big
"Cost" used * rate head
form reading, "Add weekly reading"
"Appliances (units per month)" head
let biggest = max(appliance, it.watts * it.hours)
each appliance
  row card
    it.name grow
    round(it.watts * it.hours * 30 / 1000) "units" bold
    if(it.watts * it.hours = biggest, "Tip: use less", "") color warn
form appliance, "Add appliance"
