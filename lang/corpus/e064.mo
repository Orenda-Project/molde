app "Houseplants" plant mint
table plant name text, days_gap num 1..60 = 3
table water plant ref plant
each plant sort name
  row card
    stack grow
      it.name bold
      "Water every" it.days_gap "days" faint
    if(since(it.water) >= it.days_gap, "Water today", "OK") bold color if(since(it.water) >= it.days_gap, warn, good)
    button "Watered" tap add water plant = it
form plant, "Add plant"
