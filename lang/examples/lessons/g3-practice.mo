app "Practise fractions" book green
lesson
section "You will learn to"
  each objective
    "•" it.body
each question as x
  stack card gap 2
    x.n "." x.prompt bold
    each x.option as o
      "○" o.label
    reveal "Answer:" x.solution "·" x.explanation
