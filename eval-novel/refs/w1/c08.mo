app "Rest timer" timer ocean
table setdone
state ends when = now
state going bool = no
state secs dur = 90s
when going and now >= ends set going = no then notify "Rest over, next set"
row gap 1
  button "60 s" tap set secs = 60s then set ends = now + 60s then set going = yes
  button "90 s" tap set secs = 90s then set ends = now + 90s then set going = yes
  button "120 s" tap set secs = 120s then set ends = now + 120s then set going = yes
  button "150 s" tap set secs = 150s then set ends = now + 150s then set going = yes
text if(going, max(ends - now, 0s), secs) huge align center
row gap 1
  button "Set done" tap add setdone
  button "Stop" tap set going = no
stat count(setdone today), "sets done today"
