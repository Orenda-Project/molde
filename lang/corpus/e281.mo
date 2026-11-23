app "Rent sheet" home slate
table flat name text, rent money
table paid flat ref flat
state m date = today
monthnav m
count(flat) - sumof(flat, if(count(it.paid month of m) > 0, 1, 0)) "unpaid flats" head
"Collected" sumof(flat, if(count(it.paid month of m) > 0, it.rent, 0)) "of" sum(flat.rent) faint
grid 2 gap 1
  each flat as f
    stack radius 8 pad 1 fill if(count(f.paid month of m) > 0, good, bad) tap toggle f.paid month of m
      f.name bold color bg
      if(count(f.paid month of m) > 0, "Paid", "Unpaid") f.rent size small color bg
form flat, "Add flat"
