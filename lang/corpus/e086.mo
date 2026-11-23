app "Homework List" book ocean
table hw child text, subject text, what text, done bool
each hw where done = no sort at desc
  row card tap edit it
    stack grow
      it.child it.subject bold
      it.what faint
    toggle it.done
form hw, "Add homework"
