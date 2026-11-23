app "Catering" food plum
table job client text, day date, heads num 1..2000, advance money = 0
table item job ref job, dish text, price money "Price per head"
remind "Catering event today" at job.day
each job sort day as j
  stack card gap 1
    row
      j.client head grow
      j.day bold
    j.heads "guests. Menu:" faint
    each j.item
      row
        it.dish grow
        it.price "per head"
    "Quotation:" j.heads * sum(j.item.price) bold
    "Advance paid" j.advance "| Balance" j.heads * sum(j.item.price) - j.advance faint
form job, "New order"
form item, "Add menu item"
