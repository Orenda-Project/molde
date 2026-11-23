app "Plants" plant mint
table plant name text, gap_days num 1..60 = 3 "Water every (days)"
table water plant ref plant
let due = count(plant, due(it.water, it.gap_days))
due "plants to water" head color if(due > 0, warn, good)
remind "Water the plants" at 8:00 if due > 0
each plant as p
  row card gap 1 tap edit p swipe remove p
    stack grow
      p.name bold
      "Last watered" last(p.water.at) faint
    button "Watered" tap add water plant = p
form plant, "Add plant"
