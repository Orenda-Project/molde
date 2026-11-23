app "Board" board ink
table job title text, col pick To_do|Doing|Done = To_do
row gap 1
  each options job.col as c
    stack grow gap 1
      c head
      each job where col = c as j
        stack card gap 1
          j.title bold
          row gap 1
            each options job.col as o
              if o != c
                button o size tiny tap set j.col = o
form job, "Add card"
