app "Cricket Matches" ball ocean
table match runs num 0..400, wickets num 0..10
"Average runs" round(avg(match.runs)) big
"Matches" count(match) "| Total runs" sum(match.runs) "| Wickets" sum(match.wickets) faint
trend match, it.runs
form match, "Add match"
list match
