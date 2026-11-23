app "Quiz" star plum
table item question text, a text, b text, c text, right pick A|B|C
table answer item ref item, chose pick A|B|C
let score = countof(answer, it.chose = it.item.right)
text score "of" count(answer) "right" big
each item as x
  if count(x.answer) = 0
    stack card gap 1
      text x.question head
      button x.a tap add answer item = x, chose = "A"
      button x.b tap add answer item = x, chose = "B"
      button x.c tap add answer item = x, chose = "C"
each answer as r
  row
    text r.item.question grow
    text if(r.chose = r.item.right, "Right", "Wrong") color if(r.chose = r.item.right, good, bad)
form item, "Add question"
