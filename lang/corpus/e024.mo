app "Doctor Notes" note ocean
table visit doctor text, said long, next date?
remind "Doctor visit" at visit.next
each visit where next >= today sort next top 1
  row card
    "Next visit" it.next bold
form visit, "Add visit"
log visit
