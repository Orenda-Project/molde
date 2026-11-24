app "Chess clock" board ink
state a dur = 10m
state b dur = 10m
state turn num = 0
every 1s if turn = 1 and a > 0s set a = a - 1s
every 1s if turn = 2 and b > 0s set b = b - 1s
when a <= 0s and turn = 1 set turn = 0
when b <= 0s and turn = 2 set turn = 0
"Tap your side after your move" faint align center
box card fill if(turn = 2, accent, soft) height 160 tap set turn = 1
  text a huge align center
  text if(a <= 0s, "Player 1 lost on time", "Player 1") align center
box card fill if(turn = 1, accent, soft) height 160 tap set turn = 2
  text b huge align center
  text if(b <= 0s, "Player 2 lost on time", "Player 2") align center
button "Reset" tap set a = 10m then set b = 10m then set turn = 0
