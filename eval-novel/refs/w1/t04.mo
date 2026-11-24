app "Net sessions" ball ocean
table session day date = today, minutes num 1..600 unit "min", kind pick Bowling|Batting, worked text "What I worked on"
stat sum(session.minutes), "total minutes in nets"
"Minutes per week" head
bars 1..8, sum(session.minutes where day >= today - 7 * (8 - it) - weekday(today) + 1 and day < today - 7 * (7 - it) - weekday(today) + 1), join("W", it)
form session, "Log session"
list session
