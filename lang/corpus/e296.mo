app "Garden planner" plant mint
table bed name text
table planting bed ref bed, crop text, planted date
table watering bed ref bed, gap_days num 1..30 = 2
table watered bed ref bed
table harvest bed ref bed, crop text, kg num 0..
table seed name text, packets num 0.. = 1
"Beds" head
each bed as b
  stack card gap 1 tap edit b
    b.name bold
    "Planted" last(b.planting.crop) last(b.planting.planted) faint
    "Water every" last(b.watering.gap_days) "days. Last watered" last(b.watered.at) faint
    row gap 1
      button "Watered" tap add watered bed = b
      "Harvest" sum(b.harvest.kg) "kg" faint
"Seed stock" head
each seed as s
  row card gap 1
    s.name bold grow
    button "-" tap set s.packets = s.packets - 1
    s.packets bold
    button "+" tap set s.packets = s.packets + 1
form bed, "Add bed"
form planting, "Add planting"
form watering, "Set watering schedule"
form harvest, "Log harvest"
form seed, "Add seeds"
