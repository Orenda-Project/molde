app "Plants" plant mint
table plant name text, days_gap num 1..60 = 3 unit "days"
table water plant ref plant
each plant sort name
  row card gap 1
    stack grow
      it.name bold
      "Water every" it.days_gap "days. Last:" since(it.water) "days ago" faint
    if(due(it.water, it.days_gap), "Water today", "OK") color if(due(it.water, it.days_gap), warn, good)
    button "Watered" tap add water plant = it
form plant, "Add plant"
