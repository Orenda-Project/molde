app "Sleep" moon ink
table night slept time, woke time, quality num 1..5 = 3
setting need dur = 8h "Sleep goal"
let avg7 = sumof(night last 7 days, it.woke - it.slept) / count(night last 7 days)
"Average sleep, last 7 nights" faint
avg7 big color if(avg7 >= need, good, warn)
daybars last 7 days, sumof(night on it, (it.woke - it.slept) / 1h)
"Average quality" round(avg(night.quality last 7 days)) "of 5" faint
remind "Time to wind down" at 22:30
form night
log night
