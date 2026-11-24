app "Tasbeeh" beads mint
setting target num = 33 "Count to"
table zikr
let n = count(zikr)
row gap 1
  each [33, 99, 100] as t
    button t fill if(target = t, accent, soft) tap set target = t
draw width 240 middle tap add zikr
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n big
  label 50, 64, "of" target faint
button "Reset" tap remove all zikr
