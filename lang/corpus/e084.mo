app "Reading List" book plum
table book title text, author text, pages num 1..5000, started date?
table finish book ref book, rating num 1..5
"Finished this year" count(finish year) big
"Average rating" round(avg(finish.rating year) * 10) / 10 head
"Pages read per month" head
bars 0..5, sumof(finish month of addmonths(today, -it), it.book.pages), monthname(addmonths(today, -it))
each book sort title
  row card
    stack grow
      it.title bold
      it.author it.pages "pages" faint
    if(count(it.finish) > 0, "Finished", "Reading") color if(count(it.finish) > 0, good, muted)
    button "Finished" tap add finish book = it, rating = 3
form book, "Add book"
list finish
