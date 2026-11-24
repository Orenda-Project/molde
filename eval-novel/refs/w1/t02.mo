app "Hive log" leaf mint
table inspection hive num 1..200, day date = today, queen bool, brood num 0..20 unit "frames", mites pick None|Few|Many = None
each 1..12
  if count(inspection where hive = it) > 0
    row card
      "Hive" it bold grow
      "last checked" since(inspection where hive = it) "days ago" faint
form inspection, "Add inspection"
list inspection by day
