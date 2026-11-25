app "Sewing Orders" pen plum
table sewing customer text, what text, due date, thread pick Red|Blue|Green|Black|White|Yellow|Other
remind "Sewing order due" at sewing.due
each sewing sort due
  row card tap edit it swipe remove it
    stack grow
      it.customer it.what bold
      "Thread:" it.thread faint
    it.due bold color if(it.due < today, bad, ink)
form sewing, "Add order"
