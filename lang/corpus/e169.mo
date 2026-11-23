app "Car fuel" car slate
table refuel liters num 0.., price money, odo num 0..
table oil odo num 0..
setting interval num = 3000 "Oil change every (km)"
let km = max(refuel.odo) - min(refuel.odo)
let used = sum(refuel.liters) - first(refuel.liters)
let since_oil = max(refuel.odo) - last(oil.odo)
round(km / used * 10) / 10 "km per liter" big
"Since last oil change" since_oil "km" head
if(since_oil >= interval, "Oil change due now", "Km to next oil change") color if(since_oil >= interval, bad, muted)
interval - since_oil "km left" faint
when since_oil >= interval notify "Oil change is due"
button "Oil changed now" tap add oil odo = max(refuel.odo)
form refuel, "Add fill"
log refuel
