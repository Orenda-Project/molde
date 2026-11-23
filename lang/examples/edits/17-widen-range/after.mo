app "Weight" scale mint
table weigh kg num 2..300
setting target num = 70 "Target weight (kg)"
let kg = last(weigh.kg)
text kg "kg" big
text abs(round(kg - target)) "kg to target," round(kg - first(weigh.kg last 30 days)) "kg in 30 days" faint
trend weigh last 90 days sort at, it.kg
form weigh
log weigh
