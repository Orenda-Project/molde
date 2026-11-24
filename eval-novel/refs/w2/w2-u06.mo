app "Habit grid" check mint
table done habit pick Fajr|Quran|Exercise
each options done.habit as h
  row gap 1
    h bold grow
    "streak" streak(done where habit = h) faint
  grid 10 gap 1
    each days last 30 days as d
      box height 24 radius 5 tap toggle done on d where habit = h fill if(count(done on d where habit = h) > 0, accent, soft)
