app "Reading" book plum
table book title text, author text?, status pick Want|Reading|Done = Want, finished date?
state tab text = Reading
topbar book, "Add book"
count(book where status = Done and finished >= addmonths(today, -12)) "books finished in the last year" head
row gap 1
  each options book.status
    button it count(book where status = it) fill if(tab = it, ink, surface) grow tap set tab = it
each book where status = tab sort title as b empty "No books here yet. Add one with Add book."
  row card gap 2 tap edit b swipe remove b
    stack grow gap 0
      b.title bold
      b.author faint
    if b.status = Reading
      button "Finished" tap set b.status = Done then set b.finished = today
    if b.status = Want
      button "Start" tap set b.status = Reading
