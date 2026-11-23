app "Flat rents" home slate
table flat name text, rent money
table paid flat ref flat
count(flat) - count(flat, count(it.paid month) > 0) "flats unpaid this month" head
stat sum(flat, it.rent * count(it.paid month)), "collected this month"
each flat as f
  row card gap 1
    f.name bold grow
    f.rent
    toggle f.paid month
form flat, "Add flat"
