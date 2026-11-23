app "Dad's walks" run mint
table walk mins num 1..300, sys num? 0..300, dia num? 0..200
sum(walk.mins today) "minutes today" big
daybars last 7 days, sum(walk.mins on it)
"Last blood pressure" last(walk.sys) "/" last(walk.dia) head
form walk, "Log walk"
log walk
