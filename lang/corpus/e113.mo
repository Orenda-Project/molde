app "Village milk" milk mint
table farmer name text, rate money
table pickup farmer ref farmer, liters num 0.. unit "L"
sum(pickup.liters today) "L collected today" big
stat sumof(pickup month, it.liters * it.farmer.rate), "owed to farmers this month"
each farmer as f
  row card gap 1
    f.name bold grow
    sum(f.pickup.liters month) "L"
    sum(f.pickup.liters month) * f.rate bold
form farmer, "Add farmer"
form pickup, "Record milk"
log pickup
