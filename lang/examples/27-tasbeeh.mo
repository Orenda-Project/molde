app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 33 "Count to"
state ph text = SubhanAllah
let n = count(zikr today where phrase = ph)
row gap 1
  each options zikr.phrase
    button it fill if(ph = it, accent, soft) tap set ph = it
draw width 240 tap add zikr phrase = ph
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
  label 50, 64, "Round" floor(n / target) + 1 faint
when n > 0 and n % target = 0 notify "Round complete"
"Tap the circle to count." count(zikr today) "today in all." faint
