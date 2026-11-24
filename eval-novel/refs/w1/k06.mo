app "Bill estimator" bolt slate
state units num = 250
let s1 = min(units, 100) * 7
let s2 = clamp(units - 100, 0, 100) * 11
let s3 = max(units - 200, 0) * 20
let energy = s1 + s2 + s3
field units "Units used this month"
stat round(energy * 1.17), "total bill with 17% GST (Rs)"
"First 100 units at 7:" s1 faint
"Next 100 units at 11:" s2 faint
"Above 200 units at 20:" s3 faint
"Energy charges" energy "+ GST" round(energy * 0.17) faint
