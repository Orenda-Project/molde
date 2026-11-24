app "Water cycle" drop teal
lesson
text lesson.title head
stepper
  notes "My notes on this part"
section "Parts finished", count(seen) "of" count(section)
  each section
    it.title if(count(it.seen) > 0, "✓", "") faint
