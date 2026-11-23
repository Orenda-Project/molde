app "Dog walks" paw mint
table walk mins num 1..300 unit "min", km num 0.. = 1 unit "km", note text?
stat count(walk week), "walks this week"
stat sum(walk.km week), "km this week"
form walk
list walk by day
