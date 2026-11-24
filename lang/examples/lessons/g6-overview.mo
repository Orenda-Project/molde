app "Water cycle" drop mint
lesson
text lesson.title huge
section "In short"
  text lesson.summary
each section
  state more bool = no
  stack card gap 2
    it.n "." it.title head
    if more
      blocks
    else
      each it.block where kind = paragraph
        it.body
    button if(more, "Show less", "Show examples and words") fill soft tap set more = not more
section "Key words", count(term)
  each term
    it.word bold
    it.meaning small
