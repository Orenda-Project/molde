app "Zakat and tip" calc slate
setting cash money = 0 "Cash and bank"
setting gold num = 0 "Gold (grams)"
setting silver num = 0 "Silver (grams)"
setting gold_rate money = 0 "Gold price per gram"
setting silver_rate money = 0 "Silver price per gram"
setting debts money = 0 "Debts due now"
state bill money = 0
state tip num = 10
state people num = 1
let wealth = cash + gold * gold_rate + silver * silver_rate - debts
let nisab = 612.36 * silver_rate
screen zakat "Zakat" coin
  field cash
  field gold
  field silver
  field gold_rate
  field silver_rate
  field debts
  if(wealth >= nisab, "Zakat due (2.5%)", "Below nisab: no zakat due") faint
  round(if(wealth >= nisab, wealth * 0.025, 0)) big
screen split "Tip" calc
  field bill "Bill"
  "Tip" tip "%" faint
  slider tip 0..30
  "People" people faint
  slider people 1..20
  "Tip" round(bill * tip / 100) head
  "Each pays" round(bill * (1 + tip / 100) / people) big
