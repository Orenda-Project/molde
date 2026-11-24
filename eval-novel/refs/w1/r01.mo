app "Plank intervals" timer ocean
state round num = 1
state resting bool = no
state going bool = no
state ends when = now
setting work dur = 40s "Hold"
setting rest dur = 20s "Rest"
when going and now >= ends and round >= 6 and not resting set going = no then notify "All 6 rounds done"
when going and now >= ends and not resting and round < 6 set resting = yes then set ends = now + rest
when going and now >= ends and resting set resting = no then set round = round + 1 then set ends = now + work
"Round" round "of 6" head
text if(going, if(resting, "Rest", "Hold"), "Ready") big color if(resting, good, accent)
text if(going, max(ends - now, 0s), work) big
row gap 1
  button "Start" tap set round = 1 then set resting = no then set ends = now + work then set going = yes
  button "Stop" tap set going = no
