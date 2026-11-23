app "Where is it" key plum
table thing name text, place text, kind pick Keys|Papers|Other = Other
state q text = ""
field q "Search"
each thing where has(name, q) or has(place, q) sort name as t
  row card tap edit t swipe remove t
    stack grow
      t.name bold
      t.place faint
form thing, "Put something away"
