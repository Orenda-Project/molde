app "Paint litres" pen ocean
state len num = 14
state wid num = 12
state high num = 10
state doors num = 2
state windows num = 1
state coats num = 2
setting cover num 10.. = 100 "Sq ft per litre"
let walls = 2 * (len + wid) * high - doors * 21 - windows * 15
let litres = walls * coats / cover
stack card gap 2
  field len "Length (ft)"
  field wid "Width (ft)"
  field high "Height (ft)"
  field doors "Doors"
  field windows "Windows"
  field coats "Coats"
stat 0 - floor(0 - litres), "litres of emulsion to buy"
"Paintable wall area" walls "sq ft (door 21, window 15)" faint
"Exact need" fixed(litres, 1) "litres" faint
