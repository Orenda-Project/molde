app "Cycle" heart plum
table period flow_days num 1..10 = 5, mood pick Good|Okay|Low|Irritable = Okay
let cyc = round(gap(period))
"Average cycle" cyc "days" big
"Next period expected in about" cyc - since(period) "days, on" today + cyc - since(period) head
when cyc > 0 and since(period) >= cyc - 3 notify "Period expected in about 3 days"
button "Period started today" tap add period
form period, "Add past period"
calendar period
list period by day
