app "Gold stock" coin plum
table piece name text, tola num 0.., bought money, price money, sold bool
count(piece where sold = no) "pieces in stock," sum(piece.tola where sold = no) "tola" head
"Stock cost" sum(piece.bought where sold = no) "Profit on sold" sumof(piece where sold = yes, it.price - it.bought) faint
each piece where sold = no sort at as p
  row card tap edit p swipe remove p
    stack grow
      p.name bold
      p.tola "tola, bought" p.bought "ask" p.price faint
    button "Sold" tap set p.sold = yes
form piece
"Sold" head
list piece where sold = yes
