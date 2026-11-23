app "Mosque Donations" mosque mint
table donation donor text, amount money, note text?
stat sum(donation.amount all), "collected in total"
row gap 3
  stat sum(donation.amount today), "today"
  stat sum(donation.amount month), "this month"
form donation, "Add donation"
log donation
