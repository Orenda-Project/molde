app "Stretch routine" walk mint
state idx num = 0
state going bool = no
state ends when = now
let cur = if(idx = 0, "Neck roll", if(idx = 1, "Shoulder circles", if(idx = 2, "Chest opener", if(idx = 3, "Triceps stretch", if(idx = 4, "Side bend", if(idx = 5, "Hamstring reach", if(idx = 6, "Quad stretch", "Calf stretch")))))))
when going and now >= ends and idx < 7 set idx = idx + 1 then set ends = now + 30s
when going and now >= ends and idx >= 7 set going = no then set idx = 0 then notify "Stretch routine done"
text cur head align center
text if(going, max(ends - now, 0s), 30s) huge align center
goal idx + if(going, 1, 0), 8, "stretches", ""
row gap 1
  button "Start" tap set idx = 0 then set ends = now + 30s then set going = yes
  button "Stop" tap set going = no
each ["Neck roll", "Shoulder circles", "Chest opener", "Triceps stretch", "Side bend", "Hamstring reach", "Quad stretch", "Calf stretch"]
  row fill if(going and index = idx, accent, soft) pad 1
    text index + 1 bold
    text it grow
