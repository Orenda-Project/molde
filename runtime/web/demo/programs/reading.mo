app "Reading" book plum
table book title text, author text?, status pick Want|Reading|Done = Want, finished date?
state tab text = Reading
state adding bool = no
state d new book
row
  button if(adding, "Close", "Add book") fill if(adding, soft, accent) tap set adding = not adding
if adding
  stack card gap 3
    field d.title "Title"
    field d.author "Author"
    choice d.status
    button "Save book" fill accent tap save d then set adding = no
stack gap 0
  count(book where status = Done and finished >= addmonths(today, -12)) "books finished in the last year" head
  count(book where status = Reading) "reading now," count(book where status = Want) "on the wish list" color muted
row gap 1
  each options book.status
    button it count(book where status = it) fill if(tab = it, ink, surface) grow tap set tab = it
if count(book where status = tab) = 0
  "No books here yet. Add one with Add book." color muted
each book where status = tab sort title as b
  row card gap 2 tap edit b swipe remove b
    stack grow gap 0
      b.title bold
      if b.author != ""
        b.author faint
      if b.status = Done
        "Finished" b.finished faint
    if b.status = Reading
      button "Finished" tap set b.status = Done then set b.finished = today
    if b.status = Want
      button "Start" tap set b.status = Reading
