app "Gift ideas" gift plum
table gift person text, idea text, budget money, store text, bought bool
stat sum(gift.budget where bought = no), "budget still to spend"
state q text
field q "Search person or idea"
form gift, "Add idea"
each gift where has(person, q) or has(idea, q) by person as g empty "No ideas yet"
  g.key head
  each g as r
    row card swipe remove r
      toggle r.bought
      r.idea grow
      r.budget
      r.store faint
