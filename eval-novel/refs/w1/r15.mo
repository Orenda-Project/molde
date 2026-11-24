app "Speech timer" clock ocean
state mins num = 5
state held dur
state paused bool = no
state ends when = now
state going bool = no
let left = if(going, max(ends - now, 0s), if(paused, held, 1m * mins))
when going and now >= ends set going = no then set paused = no then notify "Time is up"
field mins "Minutes"
box card pad 3 fill if(left <= 0s, bad, if(left <= 60s, warn, good))
  text left huge align center
row gap 1
  if going
    button "Pause" tap set held = ends - now then set paused = yes then set going = no
  else
    button "Start" tap set ends = now + if(paused, held, 1m * mins) then set going = yes
  button "Reset" tap set going = no then set paused = no
