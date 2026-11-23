app "My book" book plum
table book title text, pages num 1.., page num 0.. = 0
each book sort at desc top 1 as b
  stack card gap 1
    b.title head
    "Stopped at page" b.page "of" b.pages
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * clamp(b.page / b.pages, 0, 1), 4 fill accent radius 2
    row gap 1
      button "-10" tap set b.page = b.page - 10
      button "+10" tap set b.page = b.page + 10
      button "Edit" tap edit b
form book, "New book"
list book
