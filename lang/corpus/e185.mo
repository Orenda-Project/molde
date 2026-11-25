app "Learning to drive" car ocean
table lesson mins num 10..240 = 60, skill pick Parking|Reverse|Roundabout|Highway|Night|Traffic = Parking, confidence num 1..5 = 3, note text?
setting test_hours num = 40 "Practice hours goal"
goal sum(lesson.mins) / 60, test_hours, "hours practised", "h"
"Confidence by skill" head
each options lesson.skill as s
  row gap 1
    s grow
    round(avg(lesson.confidence where skill = s)) "/ 5" bold
form lesson, "Log lesson"
trend lesson sort at, it.confidence
list lesson by day
