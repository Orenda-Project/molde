app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar|Astaghfirullah = SubhanAllah
setting target num = 33 "Count to"
state ph pick SubhanAllah|Alhamdulillah|AllahuAkbar|Astaghfirullah = SubhanAllah
choice ph
let n = count(zikr today where phrase = ph)
draw width 240 tap add zikr phrase = ph
  circle 50, 50, 44 stroke soft thick 8
  arc 50, 50, 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
  label 50, 64, "Round" floor(n / target) + 1 faint
"Today, all zikr:" count(zikr today) faint
daybars last 7 days, count(zikr on it)
