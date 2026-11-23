app "Class timers" timer ink
table class name text, mins num 5..240 = 60
each class as c
  state left dur = c.mins * 1m
  state going bool = no
  every 1s if going set left = left - 1s
  when going and left <= 0s set going = no then notify c.name "class is over"
  row card gap 2
    draw width 40
      circle 50, 50, 40 fill if(going, good, soft)
    stack grow
      c.name bold
      text left big
    button if(going, "Pause", "Start") tap set going = not going
    button "Reset" tap set going = no then set left = c.mins * 1m
form class, "Add class"
