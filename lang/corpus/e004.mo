app "Pill Day" pill mint
table pill name text, part pick Morning|Afternoon|Night
table taken pill ref pill
grid 3 gap 1
  each options pill.part as s
    stack card gap 1
      s head
      each pill where part = s sort name
        row
          it.name grow
          toggle it.taken
form pill, "Add pill"
