app "Reading" book plum
table book title text, author text?, status pick Want|Reading|Done = Want, finished date?
state tab text = Reading
row gap 1
  each options book.status
    button it fill if(tab = it, accent, soft) tap set tab = it
each book where status = tab sort title as b
  row card tap edit b swipe remove b
    stack grow
      b.title bold
      b.author faint
    if b.status = Reading
      button "Finished" tap set b.status = Done then set b.finished = today
stat count(book where status = Done and finished >= addmonths(today, -12)), "books finished in the last year"
form book
