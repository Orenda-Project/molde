app "Parking" car slate
table park place text = "Parking", amount money, hours num? 0..
stat sum(park.amount month), "parking this month"
stat sum(park.amount year), "parking this year"
quick park, amount, [50, 100, 200]
form park
list park by day
