app "Study Time" school ocean
table study subject pick Maths|English|Science|History|Urdu, mins num 1..600 = 30
let low = minof(options study.subject, sum(study.mins week where subject = it))
"Minutes this week" sum(study.mins week) big
each options study.subject
  row card
    it grow
    sum(study.mins week where subject = it) "min" bold
    if(sum(study.mins week where subject = it) = low, "neglected most", "") color warn
form study, "Add study time"
