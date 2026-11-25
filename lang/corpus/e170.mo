app "Donation drive" gift mint
table donation donor text, amount money
stat sum(donation.amount month), "raised this month"
stat sum(donation.amount), "raised in total"
form donation, "Add donation"
share donation month by day, sum(it.amount), it.key
list donation by day
