app "Family health" heart plum
table member name text
table reading member ref member, sys num? 0..300, dia num? 0..200, sugar num? 0..600, weight num? 0..300
table visit member ref member, reason text?
table checkup member ref member, what text, due date
remind "A health test is due today" at checkup.due
each member as m
  stack card gap 1
    m.name head
    "BP" last(m.reading.sys) "/" last(m.reading.dia) ", sugar" last(m.reading.sugar) ", weight" last(m.reading.weight) faint
    "Last visit" last(m.visit.at) faint
    "Next test" first(m.checkup.due) faint
form member, "Add member"
form reading, "Add reading"
form visit, "Add visit"
form checkup, "Add test reminder"
