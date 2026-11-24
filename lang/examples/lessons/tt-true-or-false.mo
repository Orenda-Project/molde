app "Checking understanding" school plum
lesson
text lesson.title head
"True or false?" big
each question where kind = tf as x
  stack card gap 2
    x.prompt bold
    if count(x.answer) = 0
      row gap 2
        each x.option as o
          button o.label grow tap add answer question = x, option = o, right = o.right
    else
      if(last(x.answer).right, "Right.", "Not quite.") bold color if(last(x.answer).right, good, bad)
      x.explanation
count(answer where right) "right so far" faint
