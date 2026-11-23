app "Reading minutes" book mint
table child name text
table reading child ref child, mins num 1..300
each child as c
  row card
    c.name bold grow
    sum(c.reading.mins today) "min today" faint
    sum(c.reading.mins week) "min this week" bold
form reading, "Log reading"
form child, "Add child"
list reading by day
