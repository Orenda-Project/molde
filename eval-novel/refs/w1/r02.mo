app "Tea timer" cup mint
state secs dur = 4m
state kind pick Green|Black|Doodh_patti = Black
state ends when = now
state going bool = no
when going and now >= ends set going = no then notify "Your tea is ready"
row gap 1
  button "Green 2 min" fill if(kind = Green, accent, soft) tap set kind = Green then set secs = 2m then set going = no
  button "Black 4 min" fill if(kind = Black, accent, soft) tap set kind = Black then set secs = 4m then set going = no
  button "Doodh patti 6 min" fill if(kind = Doodh_patti, accent, soft) tap set kind = Doodh_patti then set secs = 6m then set going = no
text if(going, max(ends - now, 0s), secs) huge align center
button "Start" large tap set ends = now + secs then set going = yes
