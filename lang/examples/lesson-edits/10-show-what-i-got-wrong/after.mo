app "Water cycle quiz" drop blue dark
lesson
text lesson.title huge
count(question) "questions on" lesson.subject faint
quiz "Test yourself"
section "To look at again", count(answer where not right)
  each answer where not right
    it.question.prompt bold
    "The answer is" it.question.solution faint
