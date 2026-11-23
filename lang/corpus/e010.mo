app "Stopwatch" timer ocean
table lap time dur
state t dur = 0s
state going bool = no
every 1s if going set t = t + 1s
stack align center gap 2
  text t big
  row gap 2
    button "Start" fill good tap set going = yes
    button "Stop" fill bad tap set going = no
    button "Lap" tap add lap time = t
    button "Reset" tap set going = no then set t = 0s
each lap sort at desc
  row card
    "Lap" count(lap) - index grow
    it.time bold
