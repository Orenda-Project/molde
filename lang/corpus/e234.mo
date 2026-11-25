app "Bus fare" bus slate
table fare amount money = 50, route text?
quick fare, amount, [50, 100]
"This month" sum(fare.amount month) big
"This week" sum(fare.amount week) faint
form fare
list fare by day
