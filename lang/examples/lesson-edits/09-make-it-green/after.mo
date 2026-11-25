app "Checking understanding" school green
lesson
text lesson.title head
goal count(seen), count(section), "parts read"
each section
  stack card gap 2
    row gap 2
      it.title bold grow
      toggle seen all where section = it
    if count(it.seen) = 0
      blocks
