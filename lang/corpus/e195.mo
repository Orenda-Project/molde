app "Study hours" school ocean
table study subject text?, mins num 1..600
setting goal num = 4 "Daily goal (hours)"
goal sum(study.mins today) / 60, goal, "hours today", "h"
stat sum(study.mins week) / 60, "hours this week"
daybars last 7 days, sum(study.mins on it) / 60
quick study, mins, [30, 60, 90]
form study
list study by day
