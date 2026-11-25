app "Taxi Fares" car slate
table fare amount money, note text?
stat sum(fare.amount today), "today"
stat sum(fare.amount month), "this month"
quick fare, amount, [200, 300, 500]
form fare, "Add fare"
list fare by day
