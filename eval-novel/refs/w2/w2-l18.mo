app "Plant watering" plant mint
table plant name text, every num 1..60 = 3 "Water every (days)"
table water plant ref plant
stat count(plant, due(it.water, it.every)), "plants due"
form plant, "Add plant"
each plant sort since(it.water) desc as p empty "No plants yet"
  row card swipe remove p fill if(due(p.water, p.every), warn, surface)
    stack gap 0 grow
      p.name bold
      "last watered" since(p.water) "days ago" faint
    button "Watered" tap add water plant = p
