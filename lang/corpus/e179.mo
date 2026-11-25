app "Clean rooms" home mint
table room name text
table clean room ref room
grid 2 gap 1
  each room sort name as r
    let ago = since(r.clean)
    stack card gap 1 pad 2 fill if(count(r.clean) = 0, bad, if(ago <= 3, good, if(ago <= 7, warn, bad))) tap add clean room = r
      r.name bold color bg
      if(count(r.clean) = 0, "never cleaned", "days since cleaned") color bg small
      ago big color bg
"Tap a room when you clean it." faint
form room, "Add room"
