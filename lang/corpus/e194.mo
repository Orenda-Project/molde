app "Sleep" moon ink
table night slept time, woke time
setting need dur = 8h "Sleep goal"
let avg7 = sumof(night last 7 days, (it.woke - it.slept)) / count(night last 7 days)
"Average per week" faint
text avg7 big color if(avg7 >= need, good, warn)
"Last wake-up" last(night.woke) faint
daybars last 7 days, sumof(night on it, (it.woke - it.slept) / 1h)
form night
log night
