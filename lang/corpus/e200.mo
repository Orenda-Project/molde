app "Next prayer" mosque ocean
table prayer name text, time time
let nxt = first(prayer.name where hour(time) > hour(now))
"Next prayer" faint
if(count(prayer where hour(time) > hour(now)) > 0, nxt, "Tomorrow: first prayer") head
first(prayer.time where hour(time) > hour(now)) huge big
list prayer
form prayer, "Add prayer time"
