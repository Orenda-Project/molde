app "Sowing calendar" plant mint
table crop name text, sow pick Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec, harvest pick Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec, sowed bool
stat count(crop where sowed = yes), "crops sowed"
form crop, "Add crop"
each options crop.sow as m
  if count(crop where sow = m) > 0
    m head fill if(index + 1 = month(today), accent, bg)
    each crop where sow = m as c
      row card swipe remove c
        toggle c.sowed
        c.name bold grow
        "harvest" c.harvest faint
