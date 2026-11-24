app "Zakat" coin mint
state gold num = 0
state gold_rate money = 0
state silver num = 0
state silver_rate money = 0
state cash money = 0
let total = gold * gold_rate + silver * silver_rate + cash
let nisab = 52.5 * silver_rate
stack card gap 2
  field gold "Gold (tola)"
  field gold_rate "Gold rate per tola"
  field silver "Silver (tola)"
  field silver_rate "Silver rate per tola"
  field cash "Cash at home and savings"
"Total wealth" total head
stat total * 0.025, "zakat due (2.5 percent)"
if silver_rate > 0
  if total >= nisab
    "Above nisab (52.5 tola silver = " nisab "): zakat is due" color good
  else
    "Below nisab (" nisab "): no zakat due" color warn
