app "Quiz" star plum
table question q text, a text, b text, c text, d text, right pick A|B|C|D
state qi num = 0
state score num = 0
let total = count(question)
if qi < total
  "Question" qi + 1 "of" total faint
  each question sort at as x
    if index = qi
      stack gap 1
        x.q head
        button x.a large tap set score = score + if(x.right = A, 1, 0) then set qi = qi + 1
        button x.b large tap set score = score + if(x.right = B, 1, 0) then set qi = qi + 1
        button x.c large tap set score = score + if(x.right = C, 1, 0) then set qi = qi + 1
        button x.d large tap set score = score + if(x.right = D, 1, 0) then set qi = qi + 1
else
  "Your score" score "of" total big
  button "Play again" tap set qi = 0 then set score = 0
form question, "Add question"
