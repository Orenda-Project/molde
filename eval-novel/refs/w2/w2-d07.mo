app "PR queue" list ocean
table pr title text, author text, size pick S|M|L, since date = today, reviewed bool
stat count(pr where reviewed = no), "waiting for review"
form pr, "Add PR"
each pr where reviewed = no sort since as p empty "Nothing waiting"
  row card swipe remove p
    toggle p.reviewed
    stack gap 0 grow
      p.title bold
      p.author faint
    p.size
    text today - p.since "d waiting" faint
"Reviewed" head
each pr where reviewed = yes as p
  row card opacity 0.6
    toggle p.reviewed
    p.title grow
