app "Phone time" phone slate
table session appname pick Instagram|YouTube|WhatsApp|Games|Other, mins num 1..600
setting limit num = 120 "Daily limit (minutes)"
goal sum(session.mins today), limit, "today", "min"
daybars last 7 days, sum(session.mins on it)
share session week by appname, sum(it.mins), it.key
form session, "Log time"
log session
"Blocking apps is not possible here; the app only tracks and warns." faint
