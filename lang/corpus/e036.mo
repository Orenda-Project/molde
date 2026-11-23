app "Workouts" dumbbell mint
table workout kind pick Run|Gym|Yoga|Walk = Run
state m date = today
monthnav m
grid 7 gap 1
  each ["M", "T", "W", "T", "F", "S", "S"] as w
    w size tiny color muted align center
  each 1..weekday(m - monthday(m) + 1) - 1
    box
  each days month of m as d
    stack height 44 radius 6 pad 1 fill soft
      monthday(d) size tiny
      row gap 0
        each workout on d
          draw width 10
            circle 50, 50, 40 fill if(it.kind = Run, accent, if(it.kind = Gym, good, if(it.kind = Yoga, warn, bad)))
row gap 1
  each options workout.kind
    button "+" it tap add workout kind = it
