app "Electricity" bolt ocean
table reading units num 0..
setting rate money = 40 "Price per unit"
let used = last(reading.units month) - first(reading.units month)
"Used this month" used "units" big
"Estimated bill" used * rate faint
form reading, "Add meter reading"
log reading
"The app cannot read your K-Electric account; enter the meter reading by hand." faint
