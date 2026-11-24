app "Quiz" star plum
table item question text, a text, b text, c text, right pick A|B|C
table answer item ref item, chose pick A|B|C
let score = count(answer, it.chose = it.item.right)
topbar "Quiz", item, "Add question"
goal count(answer), count(item), "right so far:" score
each item as x
  if count(x.answer) = 0
    stack card gap 2
      x.question head
      button x.a tap add answer item = x, chose = A
      button x.b tap add answer item = x, chose = B
      button x.c tap add answer item = x, chose = C
button "Start again" tap remove all answer
section "Answered", count(answer)
  each answer sort at desc as r empty "Nothing answered yet."
    r.item.question if(r.chose = r.item.right, "· right", "· not quite") bold
