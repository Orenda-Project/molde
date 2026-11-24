app "Recipe scaler" food mint
table ingredient name text, amount num 0.., unit text? "Unit"
state orig num = 4
state want num = 6
row gap 2
  field orig "Recipe serves"
  field want "I want to serve"
"Multiply everything by" fixed(want / orig, 2) head
each ingredient as i empty "Add ingredients below"
  row card tap edit i swipe remove i
    i.name grow
    fixed(i.amount * want / orig, 1) i.unit bold
form ingredient, "Add ingredient"
