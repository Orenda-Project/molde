app "Cooking Log" food mint
table cook dish text, who text, rating num 1..5
table ingredient cook ref cook, item text, qty text
form cook, "Log a meal"
form ingredient, "Add ingredient used"
"Top rated" head
each cook sort rating desc top 5
  row card
    it.dish grow
    it.rating "stars" bold
"Not cooked in over a month" head
each cook by dish
  if since(it) > 30
    row card
      it.key grow
      since(it) "days ago" color warn
"History" head
each cook sort at desc as c
  stack card gap 0
    c.dish bold
    c.at "- ate:" c.who faint
    each c.ingredient
      it.item it.qty faint
