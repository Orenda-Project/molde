app "Tailor orders" pencil plum
table order customer text, garment text, due date, done bool
each order where done = no sort due as o
  row card gap 2 tap edit o swipe remove o
    toggle o.done
    stack grow
      o.customer o.garment bold
      o.due small color if(o.due < today, bad, muted)
form order
"Done" faint
list order where done = yes
