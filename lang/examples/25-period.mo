app "Cycle" heart plum
table period flow pick Light|Medium|Heavy = Medium
let cyc = round(gap(period))
text "Day" since(period) + 1 "of your cycle" big
text "Next period in about" cyc - since(period) "days. Average cycle" cyc "days." faint
button "Period started today" tap add period
calendar period
log period
