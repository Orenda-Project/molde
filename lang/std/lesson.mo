lib "lesson"
# Ways to present a lesson (LESSON.md). They read the lesson's tables, which a `lesson` line
# declares, and keep the learner's answers, notes and progress in answer, note and seen.
# Every part is plain level-1 MoldeScript.

# describe: the blocks of the section (inside each section): paragraphs, bullet items, numbered steps, examples, terms and pictures
def blocks
  each it.block
    if it.kind = paragraph
      text it.body
    if it.kind = item
      text "•" it.body
    if it.kind = step
      text it.n "." it.body
    if it.kind = example
      stack card gap 1 fill soft
        text it.title bold
        text it.body
    if it.kind = keyterm
      stack gap 0
        text it.title bold color accent
        text it.body
    if it.kind = image
      image it.pic alt it.title
      text it.body faint

# describe: every section of the lesson as a card, one under the other
def reader
  each section
    stack card gap 2
      text it.title head
      blocks
      slot

# describe: one section at a time with its place in the lesson, Back and Next; the section reached is remembered
def stepper
  state part num = 1
  goal min(part, count(section)), count(section), "Part" min(part, count(section)) "of" count(section)
  each section where n = part
    stack card gap 2
      text it.title head
      blocks
      slot
      row gap 2
        button "Back" fill soft tap set part = max(part - 1, 1)
        button if(part < count(section), "Next", "Done") fill accent grow tap remove all seen where section = it then add seen section = it then set part = min(part + 1, count(section))

# describe: the lesson's terms as cards; tap a card to turn it over, Back and Next to move
def flashcards
  state k num = 1
  state flip bool = no
  each term where n = k
    stack card gap 2 align center pad 5 tap set flip = not flip
      text if(flip, it.meaning, it.word) big
      text if(flip, "Tap to see the word", "Tap to see the meaning") faint
  row gap 2 align center
    button "Back" fill soft tap set k = max(k - 1, 1) then set flip = no
    text k "of" count(term) grow
    button "Next" fill accent tap set k = min(k + 1, count(term)) then set flip = no

# describe: the questions one at a time: pick or type an answer, see if it was right and why, and a score at the end
def quiz caption text = "Quiz"
  state q num = 1
  state typed text = ""
  text caption head
  each question where n = q as x
    stack card gap 2
      text "Question" q "of" count(question) faint
      text x.prompt bold
      if count(x.answer) = 0
        each x.option as o
          button o.label tap add answer question = x, option = o, right = o.right
        if x.kind = short
          field typed "Your answer"
          button "Check" fill accent tap add answer question = x, reply = typed, right = has(typed, x.solution) and has(x.solution, typed) then set typed = ""
      else
        text if(last(x.answer).right, "Right!", "Not quite.") bold color if(last(x.answer).right, good, bad)
        text "The answer is" x.solution
        text x.explanation faint
        button if(q < count(question), "Next question", "See my score") fill accent tap set q = q + 1
  if q > count(question)
    stack card gap 2 align center
      text count(answer where right) "of" count(question) huge
      text "right" faint
      button "Start again" fill accent tap remove all answer then set q = 1

# describe: a button that shows {hidden} under {label} when tapped, and hides it again
def reveal hidden text, label text = "Show the answer"
  state open bool = no
  button if(open, "Hide", label) fill soft tap set open = not open
  if open
    text hidden

# describe: the learner's own notes on this section (inside each section), and a box to add one
def notes caption text = "My notes"
  state jot text = ""
  text caption bold
  each it.note
    text it.body faint
  field jot "Write a note"
  button "Save note" fill soft tap add note section = it, body = jot then set jot = ""
