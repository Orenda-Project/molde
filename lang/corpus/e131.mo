app "Mother's pills" pill plum
table taken
remind "Give mother her night pill" at 21:00
if(count(taken today) > 0, "Given tonight", "Not given yet") big color if(count(taken today) > 0, good, warn)
button "Given" tap toggle taken today
"Streak" streak(taken) "nights" faint
calendar taken
