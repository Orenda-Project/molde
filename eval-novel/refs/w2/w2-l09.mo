app "Gift ideas" gift plum
table gift person text, idea text, budget money, store text, bought bool
stat sum(gift.budget where bought = no), "budget still to spend"
form gift, "Add idea"
each gift by person as g empty "No ideas yet"
  g.key head
  each g as r
    row card swipe remove r
      toggle r.bought
      r.idea grow
      r.budget
      r.store faint
