app "Tasbeeh" beads mint
table zikr
state n num = 0
state target num = 33
when n > 0 and n = target notify "Target reached"
row gap 1
  button "33" fill if(target = 33, accent, soft) tap set target = 33
  button "99" fill if(target = 99, accent, soft) tap set target = 99
  button "100" fill if(target = 100, accent, soft) tap set target = 100
draw width 240 tap set n = n + 1 then add zikr
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * min(n, target) / target stroke if(n >= target, good, accent) thick 8
  label 50, 50, n big
if n >= target
  "Target of" target "reached" head color good
button "Reset" tap set n = 0
"Total count ever" count(zikr) faint
