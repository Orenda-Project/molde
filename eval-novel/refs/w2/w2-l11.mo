app "Books to read" book slate
table book title text, author text, status pick Want|Reading|Done = Want, rating num? 1..5
stat count(book where status = Done), "books finished"
form book, "Add book"
each options book.status as st
  if count(book where status = st) > 0
    st head
    each book where status = st as b
      row card tap edit b swipe remove b
        stack gap 0 grow
          b.title bold
          b.author faint
        b.rating "★"
