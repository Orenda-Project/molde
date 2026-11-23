app "Run log" run mint
table run km num 0.1..100
stat sum(run.km week), "km this week"
stat sum(run.km month), "km this month"
daybars last 7 days, sum(run.km on it)
form run, "Log run"
log run
