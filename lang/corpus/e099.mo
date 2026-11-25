app "Home Food" food mint
table batch dish text, cost money "Ingredients cost", portions num 1.., price money "Price per portion"
each batch sort at desc
  row card tap edit it
    stack grow
      it.dish bold
      it.portions "portions at" it.price faint
    "Profit" it.portions * it.price - it.cost bold color if(it.portions * it.price - it.cost >= 0, good, bad)
form batch, "Add batch"
"Profit this month" sum(batch month, it.portions * it.price - it.cost) head
