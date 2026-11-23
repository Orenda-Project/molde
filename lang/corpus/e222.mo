app "Game time" game ink
table play game text, played dur
sum(play.played today) "today" big
"This week" sum(play.played week) faint
daybars last 7 days, sumof(play on it, it.played / 1h)
form play, "Log play"
log play
