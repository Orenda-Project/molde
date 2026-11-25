app "Mala" beads mint
table zikr
setting target num = 100 "Daily target"
let n = count(zikr today)
stack align center gap 1
  draw width 240 tap add zikr
    circle 50, 50, 44 stroke soft thick 8
    arc 50, 50, 44, 0, 360 * clamp(n / target, 0, 1) stroke accent thick 8
    label 50, 46, n big
    label 50, 64, "of" target faint
  if(n >= target, "Target reached", "Tap to count") faint
daybars last 7 days, count(zikr on it)
