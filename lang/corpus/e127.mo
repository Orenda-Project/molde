app "Homework" pencil ocean
table child name text
table hw child ref child, subject text, due date, mins num 0.. = 0, done bool
state kid ref child
choice kid
"Weekly average" round(sum(hw.mins last 28 days where child = kid) / 4) "min" big
each hw where child = kid sort due as h
  row card gap 1 tap edit h
    stack grow
      h.subject bold color if(h.due < today and h.done = no, bad, ink)
      "due" h.due faint color if(h.due < today and h.done = no, bad, muted)
    h.mins "min"
    toggle h.done
form hw, "Add homework"
form child, "Add child"
