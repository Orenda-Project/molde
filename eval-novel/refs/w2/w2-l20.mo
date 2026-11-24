app "Watch list" star plum
table title name text, recommender text, platform pick Netflix|YouTube|Cinema, seen bool, rating num? 1..5
stat count(title where seen = no), "still to watch"
form title, "Add title"
each options title.platform as pf
  if count(title where platform = pf) > 0
    pf head
    each title where platform = pf as t
      row card tap edit t swipe remove t
        toggle t.seen
        stack gap 0 grow
          t.name bold
          "from" t.recommender faint
        t.rating
