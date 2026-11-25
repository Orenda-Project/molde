app "Kids day" smile mint
table kid name text
table screentime kid ref kid, mins num 0..
table homework kid ref kid, what text, done bool
table bed kid ref kid, slept time
table goodday kid ref kid
setting pts num = 5 "Points per good day"
each kid as k
  stack card gap 1
    row
      k.name head grow
      count(k.goodday) * pts "points" big
    "Screen time today" sum(k.screentime.mins today) "min" faint
    "Homework left" count(k.homework where done = no) faint
    "Last bedtime" last(k.bed.slept) faint
    row gap 1
      button "Good day" tap toggle k.goodday today
      button "+15 min screen" tap add screentime kid = k, mins = 15
form kid, "Add child"
form homework, "Add homework"
form bed, "Log bedtime"
list homework
