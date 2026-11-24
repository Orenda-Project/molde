app "Baby feeds" baby plum
table feed side pick Left|Right, len dur
state going bool = no
state side pick Left|Right = Left
state started when = now
stat last(feed.side), "last fed from"
if going
  text now - started big align center
  button "Stop and save" large tap add feed side = side, len = now - started then set going = no
else
  row gap 1
    button "Left" large tap set side = Left then set started = now then set going = yes
    button "Right" large tap set side = Right then set started = now then set going = yes
"Average feed" avg(feed.len) faint
list feed by day
