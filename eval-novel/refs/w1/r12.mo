app "Egg timer" egg mint
state secs dur = 8m
state kind pick Soft|Medium|Hard = Medium
state ends when = now
state going bool = no
when going and now >= ends set going = no then notify "Eggs are done. Take them out."
row gap 1
  button "Soft 6 min" fill if(kind = Soft, accent, soft) tap set kind = Soft then set secs = 6m then set going = no
  button "Medium 8 min" fill if(kind = Medium, accent, soft) tap set kind = Medium then set secs = 8m then set going = no
  button "Hard 11 min" fill if(kind = Hard, accent, soft) tap set kind = Hard then set secs = 11m then set going = no
text if(going, max(ends - now, 0s), secs) huge align center
button "Start" large tap set ends = now + secs then set going = yes
