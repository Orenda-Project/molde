app "Water Glass" cup ocean
table glass
setting goal num = 8 "Glasses per day"
let n = count(glass today)
draw 100, 120 width 160 tap add glass
  rect 26, 110 - 100 * clamp(n / goal, 0, 1), 48, 100 * clamp(n / goal, 0, 1) fill accent opacity 0.7
  path "M25 10v100h50V10" stroke ink thick 2
n "of" goal "glasses" big
"Tap the glass to add one" faint
button "Undo" tap remove last(glass today)
