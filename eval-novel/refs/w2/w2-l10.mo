app "Iftar roster" moon plum
table roster day num 1..30, person text, brings text, done bool
setting start date = today "Ramadan day 1"
stat count(roster where done = yes), "days done"
"Today" head
each roster where day = today - start + 1 as t empty "Nobody listed for today"
  row card
    t.person bold grow
    t.brings
form roster, "Add day"
each roster sort day as r
  row card swipe remove r
    toggle r.done
    "Day" r.day bold
    r.person grow
    r.brings faint
