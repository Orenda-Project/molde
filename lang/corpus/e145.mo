app "Meter" bolt ocean
table reading units num 0..
let m0 = max(reading.units month)
let m1 = max(reading.units prev month)
let m2 = max(reading.units month of addmonths(today, -2))
"Units used this month" m0 - m1 big
"Last month" m1 - m2 "units" faint
if(m0 - m1 > m1 - m2, "More than last month", "Same or less than last month") color if(m0 - m1 > m1 - m2, warn, good)
form reading, "Enter meter reading"
list reading by day
