app "Call friends" phone mint
table friend name text, gap_w num 1..52 = 4 "Call every (weeks)", next date = today
remind "Call an old friend" at friend.next
each friend sort next as f
  row card gap 1 tap edit f
    stack grow
      f.name bold
      "next call" f.next faint
    if(f.next <= today, "Due", "") color warn
    button "Called" tap set f.next = today + f.gap_w * 7
form friend, "Add friend"
