app "Cycle" heart plum
table period flow pick Light|Medium|Heavy = Medium
let cyc = round(gap(period))
text "Day" since(period) + 1 "of your cycle" big
text "Next period in about" cyc - since(period) "days. Average cycle" cyc "days." faint
draw width 160
  circle 50, 50, 42 stroke soft thick 10
  arc 50, 50, 42, 0, 360 * clamp(since(period) / cyc, 0, 1) stroke accent thick 10
  label 50, 50, "Day" since(period) + 1 bold
button "Period started today" tap add period
calendar period
log period
