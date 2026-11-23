app "Flashcards" cards plum
table flash word text, meaning text
state i num = 0
state flipped bool = no
each flash sort at as c
  if index = i
    stack card gap 2 pad 4 align center tap set flipped = not flipped
      if flipped
        c.meaning big
      else
        c.word big
      "Tap to flip" faint
row gap 1
  button "Previous" tap set i = clamp(i - 1, 0, count(flash) - 1) then set flipped = no
  button "Next" tap set i = clamp(i + 1, 0, count(flash) - 1) then set flipped = no
text i + 1 "of" count(flash) faint
form flash, "Add card"
