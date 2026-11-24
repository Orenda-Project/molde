app "Fraction words" book purple dark
lesson
text lesson.title head
"Learn the words of the lesson. Tap a card to turn it over." faint
flashcards
section "All the words", count(term)
  each term
    it.word bold
    reveal it.meaning, "Show the meaning"
