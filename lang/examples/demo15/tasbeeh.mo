app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 33 "Count to"
state ph text = SubhanAllah
let n = count(zikr today where phrase = ph)
scroll gap 1
  each options zikr.phrase
    button it fill if(ph = it, ink, surface) tap set ph = it
draw width 280 tap add zikr phrase = ph
  circle 44 stroke soft thick 7
  arc 44, 0, 360 * (n % target) / target stroke accent thick 7
  label 50, 40, n % target huge
  label 50, 68, "of" target "· round" floor(n / target) + 1 color muted
"Tap anywhere on the circle to count" faint align center
when n > 0 and n % target = 0 notify "Round complete"
section "Today", count(zikr today) "in all"
  each options zikr.phrase as o
    row gap 2
      o grow
      count(zikr today where phrase = o) bold
      plural(floor(count(zikr today where phrase = o) / target), "round") color muted
