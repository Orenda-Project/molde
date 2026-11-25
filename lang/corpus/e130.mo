app "Orders" package plum
table order customer text, fabric pick Red|Blue|Green|Yellow|Black|Grey = Blue, chest num 0.., waist num 0.., length num 0.., due date, done bool
each order where done = no sort due as o
  stack card gap 1
    row gap 1
      box width 4 height 4 radius 6 fill if(o.fabric = Red, bad, if(o.fabric = Blue, accent, if(o.fabric = Green, good, if(o.fabric = Yellow, warn, if(o.fabric = Black, ink, muted)))))
      o.customer bold grow
      "Due" o.due fill bad color bg small radius 6 pad 1
    row gap 1
      stack radius 6 pad 1 fill soft grow
        "Chest" tiny faint
        o.chest bold
      stack radius 6 pad 1 fill soft grow
        "Waist" tiny faint
        o.waist bold
      stack radius 6 pad 1 fill soft grow
        "Length" tiny faint
        o.length bold
    row gap 1
      o.fabric faint grow
      toggle o.done
form order, "New order"
