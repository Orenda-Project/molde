app "Machine care" tool slate
table care day date = today, kind pick Oil|Repair, cost money = 0
stat today - last(care.day where kind = Oil), "days since last oiling"
"Spent on repairs" sum(care.cost where kind = Repair) faint
form care, "Add entry"
list care by day
