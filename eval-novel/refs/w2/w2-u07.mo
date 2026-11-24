app "Quiz" brain ocean
table answer q num 1..5, ok bool
state qi num = 1
let ques(n num) = if(n = 1, "Capital of Pakistan?", if(n = 2, "How many continents are there?", if(n = 3, "Largest planet?", if(n = 4, "Boiling point of water in C?", "Fastest land animal?"))))
let oa(n num) = if(n = 1, "Karachi", if(n = 2, "7", if(n = 3, "Mars", if(n = 4, "90", "Lion"))))
let ob(n num) = if(n = 1, "Islamabad", if(n = 2, "5", if(n = 3, "Jupiter", if(n = 4, "120", "Cheetah"))))
let oc(n num) = if(n = 1, "Lahore", if(n = 2, "6", if(n = 3, "Saturn", if(n = 4, "100", "Horse"))))
let right(n num) = if(n = 1, 2, if(n = 2, 1, if(n = 3, 2, if(n = 4, 3, 2))))
let answered = count(answer where q = qi) > 0
if qi > 5
  stat count(answer where ok = yes), "score out of 5"
  button "Restart" tap remove all answer then set qi = 1
else
  "Question" qi "of 5" faint
  text ques(qi) head
  button oa(qi) tap add answer q = qi, ok = right(qi) = 1
  button ob(qi) tap add answer q = qi, ok = right(qi) = 2
  button oc(qi) tap add answer q = qi, ok = right(qi) = 3
  if answered
    if(last(answer.ok), "Correct", "Wrong") bold color if(last(answer.ok), good, bad)
    button "Next" tap set qi = qi + 1
