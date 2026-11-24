app "Pomodoro" timer ink
state phase pick Work|Break|Long = Work
state round num = 1
state held dur = 25m
state ends when = now
state going bool = no
when going and phase = Work and round < 4 and now >= ends set phase = Break then set ends = now + 5m then notify "Break time"
when going and phase = Work and round >= 4 and now >= ends set phase = Long then set ends = now + 15m then notify "Long break"
when going and phase = Break and now >= ends set phase = Work then set round = round + 1 then set ends = now + 25m then notify "Back to work"
when going and phase = Long and now >= ends set phase = Work then set round = 1 then set ends = now + 25m then notify "New cycle"
"Round" round "of 4" head align center
text phase color if(phase = Work, accent, good) align center
text if(going, max(ends - now, 0s), held) huge align center
row gap 1
  if going
    button "Pause" tap set held = ends - now then set going = no
  else
    button "Start" tap set ends = now + held then set going = yes
  button "Reset" tap set going = no then set phase = Work then set round = 1 then set held = 25m
