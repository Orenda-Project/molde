app "Garden Seeds" plant mint
table seed name text, plant_in pick Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec
"Plant this month" monthname(today) head
each seed where has(monthname(today), plant_in)
  row card
    it.name grow bold
"All seeds" head
each seed sort name
  row card tap edit it swipe remove it
    it.name grow
    it.plant_in faint
form seed, "Add seed"
