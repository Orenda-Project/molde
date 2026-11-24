app "Trip fuel split" car ocean
state dist num = 300
state kmpl num = 12
state price money = 270
state people num = 4
state round bool = no
stack card gap 2
  field dist "Distance (km)"
  field kmpl "Car km per litre"
  field price "Petrol price per litre"
  field people "People sharing"
  "Round trip" faint
  toggle round
let km = dist * if(round, 2, 1)
let cost = km / kmpl * price
stat cost, "total fuel cost"
stat cost / people, "per person"
"Distance driven" km "km," fixed(km / kmpl, 1) "litres" faint
