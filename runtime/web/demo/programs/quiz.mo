app "Quiz" star plum
table item question text, a text, b text, c text, right pick A|B|C
table answer item ref item, chose pick A|B|C
state adding bool = no
let score = countof(answer, it.chose = it.item.right)
let todo = countof(item, count(it.answer) = 0)
row
  button if(adding, "Close", "Add question") tap set adding = not adding
if adding
  form item, "Save question"
stack gap 1
  text score "of" count(answer) "right" big
  draw 100, 3
    rect 0, 0, 100, 3 fill soft radius 1.5
    rect 0, 0, 100 * count(answer) / count(item), 3 fill accent radius 1.5
  text todo if(todo = 1, "question", "questions") "left of" count(item) color muted
each item as x
  if count(x.answer) = 0
    stack card gap 2
      x.question head
      button x.a tap add answer item = x, chose = A
      button x.b tap add answer item = x, chose = B
      button x.c tap add answer item = x, chose = C
if todo = 0 and count(item) > 0
  stack card gap 2 align center
    "All done:" score "of" count(item) "right" head
    button "Start again" fill accent tap remove all answer
"Answered" head
if count(answer) = 0
  "Nothing answered yet." color muted
each answer sort at desc as r
  stack card gap 0
    r.item.question bold
    if r.chose = r.item.right
      "Right" color good
    else
      "Not quite. The answer is" if(r.item.right = A, r.item.a, if(r.item.right = B, r.item.b, r.item.c)) color bad
