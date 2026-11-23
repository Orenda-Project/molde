app "Bike trips" bike mint
table trip route text, km num 0.., fuel money, toll money = 0
let spent = sum(trip.fuel month) + sum(trip.toll month)
stat sum(trip.km month), "km this month"
stat spent, "spent this month"
stat sum(trip.fuel month), "fuel"
stat sum(trip.toll month), "tolls"
form trip
list trip
