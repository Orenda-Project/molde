app "Exam prep" school plum
table question q text, a text, b text, c text, right pick A|B|C, topic text
table attempt question ref question, chose pick A|B|C
setting exam date = today "Exam date"
text exam - today "days to the exam" big
"Practice score" countof(attempt, it.chose = it.question.right) "of" count(attempt) head
each question as x
  stack card gap 1
    x.q bold
    row gap 1
      button x.a tap add attempt question = x, chose = A
      button x.b tap add attempt question = x, chose = B
      button x.c tap add attempt question = x, chose = C
"Weak topics" head
each question by topic
  if sumof(it, count(it.attempt where chose != question.right)) > 0
    row
      it.key grow
      sumof(it, count(it.attempt where chose != question.right)) "wrong"
form question, "Add question from my notes"
