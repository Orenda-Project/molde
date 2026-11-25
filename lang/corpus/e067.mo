app "Tournament" trophy ocean
table team name text
table fixture home ref team, away ref team, day date, hs num 0.., as_ num 0..
table innings who text, runs num 0..
each team as t
  row card
    t.name bold grow
    "Played" count(fixture where home = t or away = t) "Won" count(fixture where home = t and hs > as_) + count(fixture where away = t and as_ > hs) bold
"Fixtures" head
each fixture sort day
  row card tap edit it
    it.home.name it.hs "-" it.as_ it.away.name
form team, "Add team"
form fixture, "Add fixture and score"
"Top batsmen" head
each innings by who
  row
    it.key grow
    sum(it.runs) bold
form innings, "Add batting score"
