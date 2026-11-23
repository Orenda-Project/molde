app "Late eating" moon plum
table meal what text
setting cutoff num = 21 "Latest hour to eat"
remind "Kitchen closes soon" at 20:30
count(meal week where hour(at) >= cutoff) "late meals this week" head color if(count(meal week where hour(at) >= cutoff) > 0, warn, good)
daybars last 7 days, count(meal on it where hour(at) >= cutoff)
form meal, "Log food"
log meal
