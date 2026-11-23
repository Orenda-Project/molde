app "Shifts" clock ocean
table shift ward text?, kind pick Day|Evening|Night = Day, hours num 1..24 = 8
sum(shift.hours month) "hours worked this month" big
stat count(shift month where kind = Night), "night shifts this month"
stat count(shift month), "shifts this month"
calendar shift
form shift, "Add shift"
log shift
