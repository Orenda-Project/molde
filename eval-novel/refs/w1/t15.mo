app "Cuttings" plant mint
table cutting plant text, cut date = today "Date cut", rooted bool, potted date? "Date potted"
form cutting, "Add cutting"
each cutting sort it.cut desc empty "No cuttings yet"
  row card tap edit it
    stack grow gap 0
      it.plant bold
      text "Cut" it.cut "(" today - it.cut "days ago)" faint
      "Potted" it.potted faint
    toggle it.rooted
