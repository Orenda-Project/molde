app "Evening Reading" book plum
table read mins num 1..600 = 20, book text?
setting goal num = 20 "Daily minutes goal"
remind "Time to read" at 20:30
"Streak" streak(read) "days" big
goal sum(read.mins today), goal, "minutes tonight", "min"
"Best streak" best(read) "days" faint
quick read, mins, [10, 20, 30]
form read
daybars last 7 days, sum(read.mins on it)
log read
