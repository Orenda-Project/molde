app "Night Journal" smile plum
table entry summary text, mood pick "😀"|"🙂"|"😐"|"😟"|"😢" = "🙂", g1 text, g2 text, g3 text
state m date = today
form entry, "Write tonight"
"Gratitude entries" count(entry month of m) * 3 head
monthnav m
grid 7 gap 1
  each ["M", "T", "W", "T", "F", "S", "S"] as w
    w tiny color muted align center
  each 1..weekday(m - monthday(m) + 1) - 1
    box
  each days month of m as d
    box height 36 radius 6 fill if(count(entry on d) = 0, soft, if(count(entry on d where mood = "😀" or mood = "🙂") > 0, good, if(count(entry on d where mood = "😐") > 0, warn, bad)))
      monthday(d) small align center
list entry by day
