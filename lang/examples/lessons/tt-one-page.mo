app "Checking understanding" school grey light huge
lesson
text lesson.title head
section "By the end you can"
  each objective
    it.n "." it.body
section "Summary"
  text lesson.summary
section "Key words", count(term)
  each term
    it.word bold
    reveal it.meaning, "What does it mean?"
