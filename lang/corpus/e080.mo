app "Bookshelf" book plum
table book title text, pages num 20..2000 = 200, colour pick Blue|Green|Orange|Red|Grey = Blue, rating num 1..5, notes long?
state sel text = ""
scroll
  each book sort title
    box width 36 height 100 radius 3 fill if(it.colour = Blue, accent, if(it.colour = Green, good, if(it.colour = Orange, warn, if(it.colour = Red, bad, muted)))) tap set sel = it.title
      it.title size tiny color bg
each book where title = sel
  stack card gap 1
    it.title head
    "Rating" it.rating "of 5" bold
    it.notes
    button "Edit" tap edit it
form book, "Add book"
