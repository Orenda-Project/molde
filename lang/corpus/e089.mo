app "Sleep Clock" bed plum
setting bed time = 23:00 "Bedtime"
setting wake time = 7:00 "Wake-up time"
let a = 360 * (((bed - 0:00) / 1h) % 12) / 12
let b = 360 * (((wake - 0:00) / 1h) % 12) / 12
draw width 220
  circle 50, 50, 46 stroke edge thick 1
  arc 50, 50, 38, a, if(b > a, b, b + 360) stroke accent thick 6
  label 50, 8, "12" tiny
  label 92, 52, "3" tiny
  label 50, 96, "6" tiny
  label 8, 52, "9" tiny
  label 50, 50, ((wake - bed) / 1h + 24) % 24 big
"Bedtime" bed "Wake-up" wake head
