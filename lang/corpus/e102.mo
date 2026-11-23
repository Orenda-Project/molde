app "Small spends" coin mint
table spend what text, amount money, kind pick Tea|Snack|Ride|Other = Snack
setting daily_cap money = 500 "Daily small-spend cap"
setting saved_goal money = 10000 "Savings goal"
table saved amount money
goal sum(spend.amount today), daily_cap, "spent on small things today"
stat sum(spend.amount month), "small spends this month"
stat sum(spend.amount month) * 12, "a year at this pace"
share spend month by kind, sum(it.amount), it.key
daybars last 7 days, sum(spend.amount on it)
form spend, "Add spend"
goal sum(saved.amount), saved_goal, "saved so far"
form saved, "Put aside"
list spend by day
