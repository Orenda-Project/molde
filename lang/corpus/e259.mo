app "Rent" home slate
table flat name text, rent money
table paid flat ref flat
state m date = today
monthnav m
"Collected" sumof(flat, if(count(it.paid month of m) > 0, it.rent, 0)) "of" sum(flat.rent) big
each flat as f
  row card fill if(count(f.paid month of m) > 0, good, bad) tap toggle f.paid month of m
    f.name bold grow color bg
    if(count(f.paid month of m) > 0, "Paid", "Not paid") f.rent color bg
form flat, "Add flat"
