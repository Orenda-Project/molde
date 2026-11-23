app "Study time" school ocean
table session subject text, mins num 5..600
sum(session.mins today) "minutes today" big
sum(session.mins week) "minutes this week" faint
daybars last 7 days, sum(session.mins on it)
share session week by subject, sum(it.mins), it.key
form session, "Log study"
list session by day
